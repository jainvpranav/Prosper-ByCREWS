# ============================================================
# prepare_framingham.py
# ============================================================
# Renames Framingham columns to Prosper schema, drops
# unusable columns, and runs the full train/val/test split
# using Stratified K-Fold (because dataset is only 4,240 rows).
#
# RUN:
#   python prepare_framingham.py \
#     --input framingham_heart_study.csv
# ============================================================

import argparse
import os
import sys
import pandas as pd
from sklearn.model_selection import StratifiedKFold, train_test_split

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

parser = argparse.ArgumentParser()
parser.add_argument("--input", required=True)
args = parser.parse_args()

# ── Step 1: Load ─────────────────────────────────────────────
df = pd.read_csv(args.input)
print(f"[prepare] Loaded {len(df):,} rows")

# ── Step 2: Rename columns to Prosper schema ─────────────────
RENAME_MAP = {
    "male":           "gender",        # will convert 1/0 → Male/Female below
    "age":            "age",
    "currentSmoker":  "smoker",
    "cigsPerDay":     "cigsperday",    # kept as extra feature
    "BPMeds":         "bp_medication", # kept as extra feature
    "prevalentStroke":"prev_stroke",   # kept as extra feature
    "prevalentHyp":   "hypertension",  # kept as extra feature
    "diabetes":       "diabetes",      # kept as extra feature
    "totChol":        "cholesterol",
    "sysBP":          "systolic_bp",
    "diaBP":          "diastolic_bp",
    "BMI":            "bmi",
    "heartRate":      "resting_hr",
    "glucose":        "glucose",       # kept as extra feature
    "TenYearCHD":     "disease_risk",
}

# Drop columns with no signal or not collectible in the app
DROP_COLS = ["education"]

df = df.drop(columns=[c for c in DROP_COLS if c in df.columns])
df = df.rename(columns=RENAME_MAP)

# ── Step 3: Convert gender 1/0 → Male/Female ─────────────────
df["gender"] = df["gender"].map({1: "Male", 0: "Female"})

# ── Step 4: Impute missing values ────────────────────────────
# All missing columns have < 10% missing — safe to impute
numeric_cols = df.select_dtypes(include="number").columns.tolist()
for col in numeric_cols:
    missing = df[col].isnull().sum()
    if missing > 0:
        median_val = df[col].median()
        df[col] = df[col].fillna(median_val)
        print(f"[prepare] Imputed {missing} missing in '{col}' with median={median_val:.2f}")

print(f"\n[prepare] Final columns: {list(df.columns)}")
print(f"[prepare] Target distribution:\n{df['disease_risk'].value_counts()}")

# ── Step 5: Split — stratified 70/15/15 ──────────────────────
# Note: with 4,240 rows this is tight but workable.
# For final production model, use all data with 5-fold CV in train.py

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
os.makedirs(DATA_DIR, exist_ok=True)

train_df, temp_df = train_test_split(
    df, test_size=0.30, random_state=42, stratify=df["disease_risk"]
)
val_df, test_df = train_test_split(
    temp_df, test_size=0.50, random_state=42, stratify=temp_df["disease_risk"]
)

train_df.to_csv(os.path.join(DATA_DIR, "train.csv"), index=False)
val_df.to_csv(  os.path.join(DATA_DIR, "val.csv"),   index=False)
test_df.to_csv( os.path.join(DATA_DIR, "test.csv"),  index=False)

print(f"\n[prepare] Train : {len(train_df):,} rows → data/train.csv")
print(f"[prepare] Val   : {len(val_df):,} rows  → data/val.csv")
print(f"[prepare] Test  : {len(test_df):,} rows  → data/test.csv")
print("[prepare] Done.")