# ============================================================
# diagnose.py — Universal dataset diagnostic for Prosper ML
# Works with ANY dataset — auto-detects columns.
#
# Usage:
#   python diagnose.py --input framingham.csv
#   python diagnose.py --input framingham.csv --target TenYearCHD
# ============================================================
import argparse
import pandas as pd
import numpy  as np
from scipy import stats

parser = argparse.ArgumentParser()
parser.add_argument("--input",  required=True,  help="Path to CSV")
parser.add_argument("--target", default=None,   help="Target column name (auto-detected if omitted)")
args = parser.parse_args()

df = pd.read_csv(args.input)

# ── Auto-detect target ──────────────────────────────────────
if args.target:
    target = args.target
else:
    # Guess: last column, or first binary int column named *risk* / *chd* / *disease*
    candidates = [c for c in df.columns if any(k in c.lower() for k in
                  ["risk", "chd", "disease", "event", "outcome", "label", "target"])]
    target = candidates[0] if candidates else df.columns[-1]
    print(f"[diagnose] Auto-detected target column: '{target}'")

# ── Prosper expected features (for compatibility check) ─────
PROSPER_FEATURES = {
    "age", "bmi", "daily_steps", "sleep_hours", "water_intake_l",
    "calories_consumed", "smoker", "alcohol", "resting_hr",
    "systolic_bp", "diastolic_bp", "cholesterol", "family_history", "gender"
}

numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
numeric_cols = [c for c in numeric_cols if c.lower() not in [target.lower(), "id"]]

SEP = "=" * 62

# ── 1. Shape & types ────────────────────────────────────────
print(f"\n{SEP}")
print("1. BASIC SHAPE & TYPES")
print(SEP)
print(df.dtypes)
print(f"\nRows: {len(df):,}  |  Columns: {len(df.columns)}")

# ── 2. Target ───────────────────────────────────────────────
print(f"\n{SEP}")
print(f"2. TARGET  →  '{target}'")
print(SEP)
vc = df[target].value_counts()
print(vc)
total = len(df)
for val, cnt in vc.items():
    print(f"  class {val}: {cnt:,}  ({cnt/total*100:.1f}%)")
print(f"Unique values: {sorted(df[target].unique())}")

imbalance_ratio = vc.max() / vc.min()
if imbalance_ratio > 5:
    print(f"\n  ⚠️  HIGH IMBALANCE — ratio {imbalance_ratio:.1f}:1  →  use scale_pos_weight = {imbalance_ratio:.2f}")
elif imbalance_ratio > 2:
    print(f"\n  ⚠️  MODERATE IMBALANCE — ratio {imbalance_ratio:.1f}:1  →  scale_pos_weight = {imbalance_ratio:.2f}")
else:
    print(f"\n  ✅  Balanced classes (ratio {imbalance_ratio:.1f}:1)")

# ── 3. Missing values ───────────────────────────────────────
print(f"\n{SEP}")
print("3. MISSING VALUES")
print(SEP)
missing = df.isnull().sum()
missing_pct = (missing / len(df) * 100).round(1)
miss_df = pd.DataFrame({"missing": missing, "pct_%": missing_pct})
miss_df = miss_df[miss_df["missing"] > 0]
if len(miss_df):
    print(miss_df.to_string())
    print("\n  ℹ️  Columns with < 20% missing: safe to impute with median/mode")
    print("  ⚠️  Columns with > 40% missing: consider dropping")
else:
    print("  ✅  No missing values")

# ── 4. Feature-target correlation ───────────────────────────
print(f"\n{SEP}")
print("4. FEATURE-TARGET CORRELATION  (key diagnostic)")
print("   |corr| > 0.10 = useful signal   p < 0.05 = statistically significant")
print(SEP)
rows = []
for col in numeric_cols:
    filled = df[col].fillna(df[col].median())
    corr, pval = stats.pointbiserialr(filled, df[target])
    signal = "✅ strong" if abs(corr) > 0.10 else ("🟡 weak" if abs(corr) > 0.04 else "❌ none")
    rows.append({
        "feature":     col,
        "correlation": round(corr, 4),
        "p_value":     round(pval, 6),
        "signal":      signal
    })

corr_df = pd.DataFrame(rows).sort_values("correlation", key=abs, ascending=False)
print(corr_df.to_string(index=False))

strong = corr_df[corr_df["correlation"].abs() > 0.10]
weak   = corr_df[(corr_df["correlation"].abs() > 0.04) & (corr_df["correlation"].abs() <= 0.10)]
none_  = corr_df[corr_df["correlation"].abs() <= 0.04]
print(f"\n  Strong signal (>0.10) : {len(strong)} features")
print(f"  Weak signal  (0.04–0.10): {len(weak)} features")
print(f"  No signal    (<0.04)  : {len(none_)} features")

if len(strong) >= 3:
    print(f"\n  ✅  DATASET IS USEFUL — {len(strong)} strongly correlated features found")
elif len(strong) + len(weak) >= 3:
    print(f"\n  🟡  DATASET IS MARGINAL — only weak signal, model will be mediocre")
else:
    print(f"\n  ❌  DATASET IS NOT USEFUL — target appears random or mislabeled")

# ── 5. Mean comparison ──────────────────────────────────────
print(f"\n{SEP}")
print("5. FEATURE MEANS BY CLASS  (sanity check)")
print("   Large diff_% = feature clearly differs between sick vs healthy")
print(SEP)
g0 = df[df[target] == 0][numeric_cols].mean()
g1 = df[df[target] == 1][numeric_cols].mean()
diff_df = pd.DataFrame({
    "mean_class0": g0.round(2),
    "mean_class1": g1.round(2),
    "diff":        (g1 - g0).round(3),
    "diff_%":      (((g1 - g0) / g0.abs().replace(0, np.nan)) * 100).round(1)
}).sort_values("diff_%", key=abs, ascending=False)
print(diff_df.to_string())

# ── 6. Prosper compatibility ─────────────────────────────────
print(f"\n{SEP}")
print("6. PROSPER FEATURE COMPATIBILITY")
print(SEP)
dataset_cols_lower = {c.lower(): c for c in df.columns}
matched, missing_in_ds, missing_in_prosper = [], [], []

# Check common mappings
MAPPINGS = {
    # dataset_col      : prosper_col
    "sysbp"            : "systolic_bp",
    "diabp"            : "diastolic_bp",
    "totchol"          : "cholesterol",
    "bmi"              : "bmi",
    "age"              : "age",
    "currentsmoker"    : "smoker",
    "heartrateRate"    : "resting_hr",
    "heartrate"        : "resting_hr",
    "glucose"          : None,   # no Prosper equivalent
    "cigsperdayday"    : None,
    "cigsperday"       : None,
    "bpmeds"           : None,
    "prevalentstroke"  : None,
    "prevalenthyp"     : None,
    "diabetes"         : None,
    "education"        : None,
    "male"             : "gender",
}

print(f"  {'Dataset column':<22} {'Maps to Prosper':<22} {'Status'}")
print(f"  {'-'*20:<22} {'-'*20:<22} {'-'*10}")
for col in df.columns:
    if col.lower() == target.lower():
        continue
    prosper = MAPPINGS.get(col.lower())
    if prosper:
        status = "✅ mapped"
    elif col.lower() in PROSPER_FEATURES:
        prosper = col.lower()
        status = "✅ direct match"
    else:
        prosper = "— no equivalent"
        status = "➕ new feature"
    print(f"  {col:<22} {str(prosper):<22} {status}")

print(f"""
  Summary:
  - Features that map directly to Prosper schema → retrain with renamed columns
  - '➕ new feature' columns → decide whether to add to Prosper or drop
  - Columns with no Prosper equivalent are still useful for training
    as long as they show signal in section 4
""")

# ── 7. Recommended scale_pos_weight ─────────────────────────
print(SEP)
print("7. RECOMMENDED CONFIG CHANGES")
print(SEP)
spw = round(vc[0] / vc[1], 2) if 0 in vc and 1 in vc else "N/A"
print(f"  scale_pos_weight = {spw}  (paste into config.py XGB_PARAMS)")
print(f"  Target column    = '{target}'  (update TARGET_COL in config.py if different)")
print(f"  Rows available   = {len(df):,}")
if len(df) < 5000:
    print(f"  ⚠️  Small dataset (<5k rows) — use 5-fold CV instead of a fixed val split")
else:
    print(f"  ✅  Dataset size is sufficient for train/val/test split")