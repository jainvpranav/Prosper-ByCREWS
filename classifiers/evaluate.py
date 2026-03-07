# ============================================================
# evaluate.py
# ============================================================
# WHAT THIS SCRIPT DOES:
#   Loads the saved pipeline and runs final evaluation on the
#   TEST set (the data the model has NEVER seen, including
#   during calibration which used val set).
#
#   This gives you the honest, unbiased performance estimate
#   you report to stakeholders or in any publication.
#
# RUN:
#   python src/evaluate.py
# ============================================================

import os
import sys
import json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import pandas as pd
import joblib
from sklearn.metrics import (
    roc_auc_score, classification_report,
    RocCurveDisplay, confusion_matrix, ConfusionMatrixDisplay
)
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from config import (
    TEST_FILE, MODEL_FILE, OUTPUT_DIR,
    TARGET_COL, ALL_FEATURES, probability_to_risk
)


def main():
    # --- Load test set ---
    print("[evaluate] Loading test set...")
    test_df = pd.read_csv(TEST_FILE)
    X_test  = test_df[ALL_FEATURES]
    y_test  = test_df[TARGET_COL]

    # --- Load pipeline ---
    print(f"[evaluate] Loading pipeline from {MODEL_FILE}...")
    artifact           = joblib.load(MODEL_FILE)
    preprocessor       = artifact["preprocessor"]
    calibrated_model   = artifact["calibrated_model"]

    # --- Predict ---
    X_test_proc = preprocessor.transform(X_test)
    y_prob      = calibrated_model.predict_proba(X_test_proc)[:, 1]
    y_pred      = calibrated_model.predict(X_test_proc)

    # --- Metrics ---
    auc    = roc_auc_score(y_test, y_prob)
    report = classification_report(y_test, y_pred)
    print(f"\n[evaluate] ===== TEST SET RESULTS =====")
    print(f"[evaluate] AUC-ROC: {auc:.4f}")
    print(report)

    # --- Show a few sample risk outputs ---
    sample = test_df.head(5).copy()
    X_sample_proc = preprocessor.transform(sample[ALL_FEATURES])
    probs         = calibrated_model.predict_proba(X_sample_proc)[:, 1]
    sample["risk_probability"] = probs
    sample["risk_category"]    = sample["risk_probability"].apply(probability_to_risk)
    print("\n[evaluate] Sample predictions:")
    print(sample[["age", "bmi", "smoker", "risk_probability", "risk_category"]].to_string())

    # --- ROC curve plot ---
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    fig, ax = plt.subplots()
    RocCurveDisplay.from_predictions(y_test, y_prob, ax=ax, name="Prosper XGBoost")
    ax.set_title("ROC Curve — Test Set")
    plt.tight_layout()
    plt.savefig(os.path.join(OUTPUT_DIR, "roc_curve_test.png"), dpi=150)
    plt.close()
    print(f"\n[evaluate] ROC curve saved.")


if __name__ == "__main__":
    main()
