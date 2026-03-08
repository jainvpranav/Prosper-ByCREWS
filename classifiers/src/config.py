# ============================================================
# config.py — Framingham Heart Study schema
# Columns match exactly what prepare_framingham.py outputs.
# ============================================================

import os

# ----------------------------------------------------------
# PATHS
# ----------------------------------------------------------
BASE_DIR   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR   = os.environ.get("SM_CHANNEL_TRAIN",   os.path.join(BASE_DIR, "data"))
MODEL_DIR  = os.environ.get("SM_MODEL_DIR",       os.path.join(BASE_DIR, "models"))
OUTPUT_DIR = os.environ.get("SM_OUTPUT_DATA_DIR", os.path.join(BASE_DIR, "models", "output"))

TRAIN_FILE   = os.path.join(DATA_DIR,  "train.csv")
VAL_FILE     = os.path.join(DATA_DIR,  "val.csv")
TEST_FILE    = os.path.join(DATA_DIR,  "test.csv")
MODEL_FILE   = os.path.join(MODEL_DIR, "prosper_pipeline.joblib")
METRICS_FILE = os.path.join(OUTPUT_DIR, "metrics.json")

# ----------------------------------------------------------
# COLUMN NAMES — must match prepare_framingham.py output exactly
# ----------------------------------------------------------
TARGET_COL = "disease_risk"
ID_COL     = "id"

NUMERIC_FEATURES = [
    "age",
    "bmi",
    "resting_hr",       # heartRate
    "systolic_bp",      # sysBP
    "diastolic_bp",     # diaBP
    "cholesterol",      # totChol
    "glucose",          # strong signal: corr=0.12
    "cigsperday",       # cigsPerDay — more granular than binary smoker
]

CATEGORICAL_FEATURES = [
    "gender",           # male → Male/Female
    "smoker",           # currentSmoker
    "hypertension",     # prevalentHyp — strongest categorical: corr=0.18
    "diabetes",         # corr=0.10
    "bp_medication",    # BPMeds — corr=0.09
    "prev_stroke",      # prevalentStroke — corr=0.06
]

ALL_FEATURES = NUMERIC_FEATURES + CATEGORICAL_FEATURES

# ----------------------------------------------------------
# RISK THRESHOLDS
# ----------------------------------------------------------
RISK_THRESHOLDS = {
    "low":    (0.00, 0.33),
    "medium": (0.34, 0.66),
    "high":   (0.67, 1.00),
}

def probability_to_risk(prob: float) -> str:
    if prob <= RISK_THRESHOLDS["low"][1]:
        return "Low"
    elif prob <= RISK_THRESHOLDS["medium"][1]:
        return "Medium"
    else:
        return "High"

# ----------------------------------------------------------
# XGBOOST HYPERPARAMETERS
# ----------------------------------------------------------
# scale_pos_weight = 5.58  → 3596 / 644 (from Framingham)
# max_depth = 3            → only 4,240 rows, prevent overfitting
# learning_rate = 0.01     → slow + more trees = better on small data
# min_child_weight = 10    → only ~640 positive samples total
# ----------------------------------------------------------
XGB_PARAMS = {
    # n_estimators: high ceiling — early stopping finds the true optimum
    "n_estimators":     1000,
    "max_depth":        3,
    # learning_rate lowered from 0.01 → 0.005 so all folds take more
    # steps before early stopping triggers. Prevents folds stopping at
    # iteration 4 while others run to 272 — smooths out best_iter.
    "learning_rate":    0.005,
    "subsample":        0.8,
    "colsample_bytree": 0.8,
    # min_child_weight raised 10 → 20: each leaf needs 20 samples minimum.
    # With ~110 positive samples per fold, this prevents the model from
    # making splits on tiny subgroups that don't generalise.
    "min_child_weight": 20,
    # gamma: minimum loss reduction to make a split. Acts as a gate —
    # only split if it meaningfully improves the objective.
    "gamma":            1.0,
    "scale_pos_weight": 5.58,
    "eval_metric":      "auc",
    "random_state":     42,
    "n_jobs":           -1,
}

SMOTE_RANDOM_STATE = None

# ----------------------------------------------------------
# CROSS-VALIDATION SETTINGS
# ----------------------------------------------------------
# Set USE_CROSS_VAL = True for small datasets (< 5k rows).
# Framingham has 4,240 rows — CV is strongly recommended.
#
# With CV, the model trains on 80% of data per fold instead
# of 70%, and the threshold is found on out-of-fold predictions
# that cover 100% of the data. Both improvements matter when
# you only have ~644 positive samples.
# ----------------------------------------------------------
USE_CROSS_VAL = True
N_FOLDS       = 5