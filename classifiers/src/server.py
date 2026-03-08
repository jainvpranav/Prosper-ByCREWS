# ============================================================
# serve.py  — v3
# ============================================================
# HOW TO RUN (from your project root, e.g. classifiers/):
#   uvicorn src.serve:app --reload --port 8000
#
# ENDPOINTS:
#   GET  /health       liveness check
#   GET  /model-info   inspect loaded model metadata
#   POST /predict      get risk score
#   GET  /docs         interactive Swagger UI (free, auto-generated)
# ============================================================

import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from typing     import Optional
from contextlib import asynccontextmanager
import pandas   as pd
import joblib
import shap

from fastapi                  import FastAPI, HTTPException
from fastapi.middleware.cors  import CORSMiddleware
from pydantic                 import BaseModel, Field, field_validator

from config import (
    MODEL_FILE, ALL_FEATURES,
    NUMERIC_FEATURES, CATEGORICAL_FEATURES,
    probability_to_risk
)

# ------------------------------------------------------------------ #
#  Global cache — loaded ONCE at startup, reused every request
# ------------------------------------------------------------------ #
_cache: dict = {
    "preprocessor": None,
    "model":        None,
    "threshold":    None,
    "explainer":    None,
}

# ------------------------------------------------------------------ #
#  Artifact loading — Lambda-compatible
# ------------------------------------------------------------------ #
def load_artifacts():
    # /tmp is the ONLY writable path in Lambda
    # Check /tmp first — avoids re-downloading on warm calls
    model_local = os.environ.get(
        "MODEL_LOCAL_PATH",
        "/tmp/prosper_pipeline.joblib"
    )

    if not os.path.exists(model_local):
        s3_uri = os.environ.get("MODEL_S3_URI", "")

        if s3_uri:
            # Running in Lambda — download from S3
            import boto3
            path   = s3_uri.replace("s3://", "")
            bucket = path.split("/")[0]
            key    = "/".join(path.split("/")[1:])
            print(f"[cold start] Downloading model from {s3_uri}")
            boto3.client("s3").download_file(bucket, key, model_local)
            print(f"[cold start] Saved to {model_local}")

        elif os.path.exists(MODEL_FILE):
            # Running locally — use local model file as before
            model_local = MODEL_FILE
            print(f"[serve] Loading local model from {model_local}")

        else:
            raise RuntimeError(
                f"\n[serve] ❌ No model found."
                f"\n         Set MODEL_S3_URI env var (Lambda)"
                f"\n         or run python src/train.py (local)"
            )
    else:
        print(f"[warm] Reusing cached model at {model_local}")

    artifact = joblib.load(model_local)
    _cache["preprocessor"] = artifact["preprocessor"]
    _cache["model"]        = artifact["model"]
    _cache["threshold"]    = artifact["threshold"]

    print("[serve] Building SHAP explainer (once) ...")
    _cache["explainer"] = shap.TreeExplainer(artifact["model"])
    print(f"[serve] ✅ Ready  |  threshold={_cache['threshold']:.4f}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_artifacts()
    yield
# ------------------------------------------------------------------ #
#  Input schema — matches Framingham-trained model exactly
# ------------------------------------------------------------------ #
class HealthInput(BaseModel):
    # Demographics
    age:    int   = Field(..., ge=1,  le=120, description="Age in years")
    gender: str   = Field(...,                description="'Male' or 'Female'")
    bmi:    float = Field(..., ge=10, le=80,  description="Body Mass Index")

    # Clinical — all optional, imputed with training median if missing
    resting_hr:   Optional[float] = Field(None, ge=30,  le=220, description="Resting heart rate (bpm)")
    systolic_bp:  Optional[float] = Field(None, ge=60,  le=250, description="Systolic BP (mmHg)")
    diastolic_bp: Optional[float] = Field(None, ge=40,  le=150, description="Diastolic BP (mmHg)")
    cholesterol:  Optional[float] = Field(None, ge=50,  le=600, description="Total cholesterol (mg/dL)")
    glucose:      Optional[float] = Field(None, ge=40,  le=500, description="Blood glucose (mg/dL)")

    # Lifestyle
    smoker:     int            = Field(..., ge=0, le=1,  description="Current smoker: 1=yes 0=no")
    cigsperday: Optional[float]= Field(None, ge=0, le=100, description="Cigarettes/day (if smoker)")

    # Medical history
    hypertension:  int = Field(..., ge=0, le=1, description="Has hypertension: 1=yes 0=no")
    diabetes:      int = Field(..., ge=0, le=1, description="Has diabetes: 1=yes 0=no")
    bp_medication: int = Field(..., ge=0, le=1, description="On BP medication: 1=yes 0=no")
    prev_stroke:   int = Field(..., ge=0, le=1, description="Prior stroke: 1=yes 0=no")

    @field_validator("gender")
    @classmethod
    def validate_gender(cls, v):
        if v not in ("Male", "Female"):
            raise ValueError("gender must be exactly 'Male' or 'Female'")
        return v


# ------------------------------------------------------------------ #
#  Core predict — also imported by SageMaker inference.py
# ------------------------------------------------------------------ #
def predict(input_dict: dict) -> dict:
    preprocessor = _cache["preprocessor"]
    model        = _cache["model"]
    threshold    = _cache["threshold"]
    explainer    = _cache["explainer"]

    # Build single-row DataFrame in the exact column order the
    # preprocessor was fitted with (order matters for ColumnTransformer)
    df_input = pd.DataFrame([input_dict], columns=ALL_FEATURES)
    X_proc   = preprocessor.transform(df_input)

    prob    = float(model.predict_proba(X_proc)[0, 1])
    at_risk = prob >= threshold

    # SHAP — fast because explainer is pre-built
    feature_names = NUMERIC_FEATURES + CATEGORICAL_FEATURES
    shap_vals     = explainer.shap_values(X_proc)[0]

    top_factors = [
        {
            "feature":   feat,
            "impact":    round(float(val), 4),
            "direction": "increases_risk" if val > 0 else "decreases_risk",
        }
        for feat, val in sorted(
            zip(feature_names, shap_vals),
            key=lambda x: abs(x[1]),
            reverse=True
        )[:3]
    ]

    return {
        "risk_probability": round(prob, 4),
        "risk_category":    probability_to_risk(prob),
        "at_risk":          bool(at_risk),
        "threshold_used":   round(threshold, 4),
        "top_factors":      top_factors,
    }


# ------------------------------------------------------------------ #
#  FastAPI app
# ------------------------------------------------------------------ #
app = FastAPI(
    title       = "Prosper Health Risk API",
    description = "Cardiovascular disease risk scoring using the Framingham model.",
    version     = "3.0.0",
    lifespan    = lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten to your mobile app domain in production
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount cancer rule-based engine
from cancer.routes import router as cancer_router
app.include_router(cancer_router)


@app.get("/health", tags=["Meta"])
def health_check():
    """Liveness check — returns ok when model is loaded and ready."""
    return {
        "status":       "ok",
        "model_loaded": _cache["model"] is not None,
        "threshold":    round(_cache["threshold"], 4) if _cache["threshold"] else None,
        "model_file":   MODEL_FILE,
    }


@app.get("/model-info", tags=["Meta"])
def model_info():
    """Returns metadata about the loaded model artifact."""
    model = _cache["model"]
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded yet")
    return {
        "features":       ALL_FEATURES,
        "n_features":     len(ALL_FEATURES),
        "threshold":      round(_cache["threshold"], 4),
        "risk_bands": {
            "Low":    "0.00 – 0.33",
            "Medium": "0.34 – 0.66",
            "High":   "0.67 – 1.00",
        },
    }


@app.post("/predict", tags=["Prediction"])
def predict_endpoint(payload: HealthInput):
    """
    Main prediction endpoint.

    Send patient data, receive:
    - risk_probability (0–1)
    - risk_category (Low / Medium / High)
    - at_risk (bool, uses optimal threshold from training)
    - top_factors (top 3 features driving the score)
    """
    try:
        return predict(payload.model_dump())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))