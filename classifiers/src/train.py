# ============================================================
# train.py  — v4  (5-fold cross-validation for small datasets)
# ============================================================
# KEY CHANGE FROM v3:
#
# Added USE_CROSS_VAL flag in config.py (set True for small
# datasets like Framingham with < 5k rows).
#
# When USE_CROSS_VAL = True:
#   - Uses StratifiedKFold(5) on the full train set
#   - Each fold trains on 80% / validates on 20%
#   - Reports mean AUC ± std across 5 folds
#   - Final model is retrained on ALL training data
#   - Threshold is found on the out-of-fold predictions
#     (these are predictions on data the model never saw,
#      assembled from all 5 folds — most reliable estimate)
#
# When USE_CROSS_VAL = False (large datasets):
#   - Uses fixed train/val split as before
# ============================================================

import os, sys, json, warnings
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy  as np
import pandas as pd
import joblib, shap
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt

from xgboost          import XGBClassifier
from sklearn.model_selection import StratifiedKFold
from sklearn.metrics  import (
    roc_auc_score, classification_report,
    confusion_matrix, ConfusionMatrixDisplay,
    precision_recall_curve, PrecisionRecallDisplay
)
from imblearn.over_sampling import SMOTE

from classifiers.src.config       import (
    TRAIN_FILE, VAL_FILE, TEST_FILE, MODEL_FILE, METRICS_FILE, OUTPUT_DIR,
    TARGET_COL, ALL_FEATURES, XGB_PARAMS, SMOTE_RANDOM_STATE,
    USE_CROSS_VAL, N_FOLDS,
    probability_to_risk
)
from preprocessor import build_preprocessor


# ------------------------------------------------------------------ #
#  STEP 1 — Load
# ------------------------------------------------------------------ #
def load_data():
    print("[train] Loading data...")
    train_df = pd.read_csv(TRAIN_FILE)

    if USE_CROSS_VAL:
        # Load val set and merge back — we'll use all of it via CV
        val_df   = pd.read_csv(VAL_FILE)
        combined = pd.concat([train_df, val_df], ignore_index=True)
        X = combined[ALL_FEATURES]
        y = combined[TARGET_COL]
        print(f"[train] CV mode: combined train+val = {X.shape[0]} rows")
        print(f"[train] Class balance:\n{y.value_counts()}")
        return X, y, None, None
    else:
        val_df  = pd.read_csv(VAL_FILE)
        X_train = train_df[ALL_FEATURES]
        y_train = train_df[TARGET_COL]
        X_val   = val_df[ALL_FEATURES]
        y_val   = val_df[TARGET_COL]
        print(f"[train] X_train: {X_train.shape}  |  X_val: {X_val.shape}")
        print(f"[train] Class balance (train):\n{y_train.value_counts()}")
        return X_train, y_train, X_val, y_val


# ------------------------------------------------------------------ #
#  STEP 2 — Preprocess
# ------------------------------------------------------------------ #
def preprocess(X_train, X_val=None):
    print("[train] Fitting preprocessor on training data...")
    preprocessor = build_preprocessor()
    X_train_proc = preprocessor.fit_transform(X_train)
    X_val_proc   = preprocessor.transform(X_val) if X_val is not None else None
    print(f"[train] Processed shape: {X_train_proc.shape}")
    return preprocessor, X_train_proc, X_val_proc


# ------------------------------------------------------------------ #
#  STEP 3 — Optionally apply SMOTE
# ------------------------------------------------------------------ #
def maybe_apply_smote(X_train_proc, y_train):
    if SMOTE_RANDOM_STATE is None:
        print("[train] SMOTE disabled — using scale_pos_weight instead.")
        return X_train_proc, y_train
    print("[train] Applying SMOTE...")
    smote = SMOTE(random_state=SMOTE_RANDOM_STATE)
    X_res, y_res = smote.fit_resample(X_train_proc, y_train)
    print(f"[train] After SMOTE: {pd.Series(y_res).value_counts().to_dict()}")
    return X_res, y_res


# ------------------------------------------------------------------ #
#  STEP 4a — Train with fixed val split (large datasets)
# ------------------------------------------------------------------ #
def train_model(X_train, y_train, X_val, y_val):
    print("[train] Training XGBoost (fixed split)...")
    print(f"[train] Params: {XGB_PARAMS}")
    model = XGBClassifier(**XGB_PARAMS)
    model.fit(
        X_train, y_train,
        eval_set=[(X_val, y_val)],
        early_stopping_rounds=50,
        verbose=50,
    )
    best = getattr(model, "best_iteration", XGB_PARAMS["n_estimators"])
    print(f"[train] Best iteration: {best}")
    return model


# ------------------------------------------------------------------ #
#  STEP 4b — 5-fold cross-validation (small datasets)
# ------------------------------------------------------------------ #
def train_with_cv(X, y):
    """
    StratifiedKFold keeps the same class ratio in every fold.

    Two things happen here:
    1. We collect out-of-fold (OOF) predictions — each sample is
       predicted exactly once by a model that never trained on it.
       This gives an unbiased probability for every row in the dataset.
       We use the OOF probabilities to find the optimal threshold.

    2. We report mean AUC ± std across folds. High std (> 0.05)
       means the model is unstable — likely need more data.

    After CV, we retrain one final model on ALL the data using
    the best n_estimators found during CV.
    """
    print(f"[train] Training with {N_FOLDS}-fold stratified CV...")
    print(f"[train] Params: {XGB_PARAMS}")

    preprocessor = build_preprocessor()

    skf       = StratifiedKFold(n_splits=N_FOLDS, shuffle=True, random_state=42)
    oof_probs = np.zeros(len(y))   # out-of-fold predictions
    fold_aucs = []
    best_iterations = []

    for fold, (train_idx, val_idx) in enumerate(skf.split(X, y)):
        X_tr, X_vl = X.iloc[train_idx], X.iloc[val_idx]
        y_tr, y_vl = y.iloc[train_idx], y.iloc[val_idx]

        # Fit preprocessor on this fold's training data only
        fold_preprocessor = build_preprocessor()
        X_tr_proc = fold_preprocessor.fit_transform(X_tr)
        X_vl_proc = fold_preprocessor.transform(X_vl)

        X_tr_bal, y_tr_bal = maybe_apply_smote(X_tr_proc, y_tr)

        model = XGBClassifier(**XGB_PARAMS)
        model.fit(
            X_tr_bal, y_tr_bal,
            eval_set=[(X_vl_proc, y_vl)],
            early_stopping_rounds=50,
            verbose=False,   # suppress per-fold verbosity
        )

        probs = model.predict_proba(X_vl_proc)[:, 1]
        oof_probs[val_idx] = probs

        fold_auc = roc_auc_score(y_vl, probs)
        fold_aucs.append(fold_auc)
        best_iter = getattr(model, "best_iteration", XGB_PARAMS["n_estimators"])
        best_iterations.append(best_iter)

        print(f"  Fold {fold+1}/{N_FOLDS}  AUC={fold_auc:.4f}  "
              f"best_iter={best_iter}")

    mean_auc = np.mean(fold_aucs)
    std_auc  = np.std(fold_aucs)
    avg_best = int(np.mean(best_iterations))

    print(f"\n[train] CV AUC: {mean_auc:.4f} ± {std_auc:.4f}")
    if std_auc > 0.05:
        print("[train] ⚠️  High variance across folds — model is unstable. "
              "Consider more data or stronger regularisation.")
    else:
        print("[train] ✅ Stable across folds.")

    # ── Retrain final model on ALL data ────────────────────────
    print(f"\n[train] Retraining final model on all {len(X)} rows "
          f"(n_estimators={avg_best})...")
    X_all_proc = preprocessor.fit_transform(X)
    X_all_bal, y_all_bal = maybe_apply_smote(X_all_proc, y)

    final_params = {**XGB_PARAMS, "n_estimators": avg_best}
    final_model  = XGBClassifier(**final_params)
    final_model.fit(X_all_bal, y_all_bal, verbose=False)

    return preprocessor, final_model, oof_probs, np.array(y), mean_auc, std_auc


# ------------------------------------------------------------------ #
#  STEP 5 — Find optimal threshold
# ------------------------------------------------------------------ #
def find_optimal_threshold(y_true, y_prob, strategy="f1", recall_floor=0.65):
    """
    strategy='f1'    → maximise F1 for class 1
    strategy='recall' → among thresholds with recall >= recall_floor,
                        pick highest F1. Use this for health apps where
                        missing sick patients is the bigger sin.
    """
    precisions, recalls, thresholds = precision_recall_curve(y_true, y_prob)

    best_threshold = 0.5
    best_score     = 0.0

    for p, r, t in zip(precisions[:-1], recalls[:-1], thresholds):
        if strategy == "recall":
            if r < recall_floor:
                continue
        f1 = 2 * p * r / (p + r + 1e-9)
        if f1 > best_score:
            best_score     = f1
            best_threshold = t

    print(f"[train] Optimal threshold: {best_threshold:.4f}  "
          f"(strategy='{strategy}', best_f1={best_score:.4f})")
    return float(best_threshold)


# ------------------------------------------------------------------ #
#  STEP 6 — Evaluate
# ------------------------------------------------------------------ #
def evaluate(y_true, y_prob, threshold, label="Validation"):
    y_pred = (y_prob >= threshold).astype(int)
    auc    = roc_auc_score(y_true, y_prob)
    report = classification_report(y_true, y_pred, output_dict=True)

    print(f"\n[train] ── {label} Results ──────────────────────")
    print(f"[train] AUC-ROC  : {auc:.4f}")
    print(f"[train] Threshold: {threshold:.4f}")
    print(classification_report(y_true, y_pred))

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Confusion matrix
    cm   = confusion_matrix(y_true, y_pred)
    disp = ConfusionMatrixDisplay(cm, display_labels=["No Risk", "At Risk"])
    fig, ax = plt.subplots()
    disp.plot(ax=ax, colorbar=False)
    plt.title(f"Confusion Matrix — {label} (threshold={threshold:.2f})")
    plt.tight_layout()
    plt.savefig(os.path.join(OUTPUT_DIR, "confusion_matrix.png"), dpi=150)
    plt.close()

    # Precision-Recall curve
    fig, ax = plt.subplots()
    PrecisionRecallDisplay.from_predictions(y_true, y_prob, ax=ax, name="XGBoost")
    ax.axvline(x=threshold, color="red", linestyle="--",
               label=f"threshold={threshold:.2f}")
    ax.set_title(f"Precision-Recall Curve — {label}")
    ax.legend()
    plt.tight_layout()
    plt.savefig(os.path.join(OUTPUT_DIR, "pr_curve.png"), dpi=150)
    plt.close()

    metrics = {
        "auc_roc":          round(auc, 4),
        "threshold":        round(threshold, 4),
        "precision_class1": round(report["1"]["precision"], 4),
        "recall_class1":    round(report["1"]["recall"],    4),
        "f1_class1":        round(report["1"]["f1-score"],  4),
    }
    with open(METRICS_FILE, "w") as f:
        json.dump(metrics, f, indent=2)

    print(f"[train] Metrics saved to {METRICS_FILE}")
    return metrics


# ------------------------------------------------------------------ #
#  STEP 7 — SHAP
# ------------------------------------------------------------------ #
def compute_shap(model, X_proc):
    from classifiers.src.config import NUMERIC_FEATURES, CATEGORICAL_FEATURES
    feature_names = NUMERIC_FEATURES + CATEGORICAL_FEATURES
    print("[train] Computing SHAP values...")
    explainer = shap.TreeExplainer(model)
    shap_vals = explainer.shap_values(X_proc[:200])  # sample for speed
    plt.figure()
    shap.summary_plot(shap_vals, X_proc[:200],
                      feature_names=feature_names,
                      plot_type="bar", show=False)
    plt.title("Feature Importance (SHAP)")
    plt.tight_layout()
    path = os.path.join(OUTPUT_DIR, "shap_importance.png")
    plt.savefig(path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"[train] SHAP plot saved to {path}")


# ------------------------------------------------------------------ #
#  STEP 8 — Save
# ------------------------------------------------------------------ #
def save_pipeline(preprocessor, model, threshold):
    os.makedirs(os.path.dirname(MODEL_FILE), exist_ok=True)
    artifact = {
        "preprocessor": preprocessor,
        "model":        model,
        "threshold":    threshold,
    }
    joblib.dump(artifact, MODEL_FILE)
    print(f"[train] Pipeline saved → {MODEL_FILE}")


# ------------------------------------------------------------------ #
#  MAIN
# ------------------------------------------------------------------ #
if __name__ == "__main__":
    X, y, X_val, y_val = load_data()

    if USE_CROSS_VAL:
        # ── CV path (small datasets) ──────────────────────────
        preprocessor, model, oof_probs, oof_labels, cv_auc, cv_std = \
            train_with_cv(X, y)

        threshold = find_optimal_threshold(
            oof_labels, oof_probs, strategy="recall", recall_floor=0.65
        )
        metrics = evaluate(oof_labels, oof_probs, threshold,
                           label=f"{N_FOLDS}-Fold OOF")

        # Also run on held-out test set for final honest estimate
        print("\n[train] Running on held-out test set...")
        test_df   = pd.read_csv(TEST_FILE)
        X_test    = test_df[ALL_FEATURES]
        y_test    = test_df[TARGET_COL]
        X_test_p  = preprocessor.transform(X_test)
        test_prob = model.predict_proba(X_test_p)[:, 1]
        test_auc  = roc_auc_score(y_test, test_prob)
        print(f"[train] Test AUC: {test_auc:.4f}")

        compute_shap(model, preprocessor.transform(X.head(200)))

    else:
        # ── Fixed split path (large datasets) ─────────────────
        preprocessor, X_train_proc, X_val_proc = preprocess(X, X_val)
        X_train_bal, y_train_bal = maybe_apply_smote(X_train_proc, y)
        model     = train_model(X_train_bal, y_train_bal, X_val_proc, y_val)
        y_prob    = model.predict_proba(X_val_proc)[:, 1]
        threshold = find_optimal_threshold(y_val, y_prob, strategy="recall")
        metrics   = evaluate(y_val, y_prob, threshold)
        compute_shap(model, X_val_proc)

    save_pipeline(preprocessor, model, threshold)

    print("\n[train] ✅ Training complete.")
    print(f"[train] AUC-ROC   : {metrics['auc_roc']}")
    print(f"[train] Threshold : {metrics['threshold']}")
    print(f"[train] Recall@1  : {metrics['recall_class1']}")
    print(f"[train] F1@1      : {metrics['f1_class1']}")