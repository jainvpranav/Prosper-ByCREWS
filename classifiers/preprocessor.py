# ============================================================
# preprocessor.py
# ============================================================
# WHAT THIS FILE DOES:
#   Builds a scikit-learn ColumnTransformer that handles ALL
#   preprocessing steps in one reusable, saveable object.
#
# WHY A PIPELINE OBJECT?
#   When you save the model with joblib, the preprocessor is
#   saved INSIDE the same file. At inference time you just call
#   pipeline.predict(raw_input) — no manual scaling needed.
#   This also means SageMaker gets the exact same transforms.
#
# STEPS EXPLAINED:
#   Numeric features:
#     1. SimpleImputer(median) — fills missing values with the
#        column median. Median is preferred over mean for health
#        data because it is robust to outliers (e.g., a BMI of
#        60 won't skew the imputed value for everyone else).
#     2. StandardScaler — centres and scales to unit variance.
#        XGBoost doesn't strictly need this, but calibration
#        (Platt scaling) and SHAP plots benefit from it.
#
#   Categorical features:
#     1. SimpleImputer(most_frequent) — fills missing with mode.
#     2. OrdinalEncoder — converts strings like "Male"/"Female"
#        to integers. We use OrdinalEncoder (not OneHot) because
#        XGBoost handles ordinal encodings natively and OneHot
#        would bloat the feature space needlessly.
# ============================================================

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sklearn.pipeline          import Pipeline
from sklearn.compose           import ColumnTransformer
from sklearn.impute            import SimpleImputer
from sklearn.preprocessing     import StandardScaler, OrdinalEncoder

from config import NUMERIC_FEATURES, CATEGORICAL_FEATURES


def build_preprocessor() -> ColumnTransformer:
    """
    Returns a fitted-ready ColumnTransformer.
    Call preprocessor.fit_transform(X_train) during training,
    then preprocessor.transform(X) at inference.
    """

    # --- Numeric branch ---
    numeric_pipeline = Pipeline(steps=[
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler",  StandardScaler()),
    ])

    # --- Categorical branch ---
    categorical_pipeline = Pipeline(steps=[
        ("imputer", SimpleImputer(strategy="most_frequent")),
        (
            "encoder",
            OrdinalEncoder(
                handle_unknown="use_encoded_value",
                unknown_value=-1,   # unseen categories become -1
            )
        ),
    ])

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", numeric_pipeline,  NUMERIC_FEATURES),
            ("cat", categorical_pipeline, CATEGORICAL_FEATURES),
        ],
        remainder="drop"   # silently drop any extra columns (e.g., id)
    )

    return preprocessor
