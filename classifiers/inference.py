# ============================================================
# inference.py  —  SageMaker Model Server entry point
# ============================================================
# WHAT SAGEMAKER EXPECTS:
#   When you deploy a model, SageMaker's multi-model server
#   looks for these four functions in inference.py:
#
#   model_fn(model_dir)
#     → Load your artifact. Called once at container startup.
#
#   input_fn(request_body, content_type)
#     → Parse the incoming HTTP request body into Python object.
#
#   predict_fn(input_data, model)
#     → Run inference. Returns raw prediction object.
#
#   output_fn(prediction, accept)
#     → Serialize prediction to HTTP response body.
#
# HOW THIS FILE REUSES serve.py:
#   All the actual logic (preprocess → predict → SHAP) lives in
#   serve.py::predict(). This file is just the glue layer that
#   speaks SageMaker's protocol and delegates to that function.
#
# DEPLOYMENT:
#   You never call this file directly. SageMaker calls it.
#   See scripts/deploy_sagemaker.py for how to deploy.
# ============================================================

import os
import sys
import json

# SageMaker places your source code in /opt/ml/code
sys.path.insert(0, "/opt/ml/code/src")

import joblib
from config import MODEL_FILE


def model_fn(model_dir: str):
    """
    Load the saved pipeline artifact.
    `model_dir` is the directory SageMaker downloads your model
    artifact (tar.gz from S3) into — typically /opt/ml/model.
    """
    artifact_path = os.path.join(model_dir, "prosper_pipeline.joblib")
    artifact      = joblib.load(artifact_path)
    return artifact


def input_fn(request_body: str, content_type: str = "application/json"):
    """
    Parse the incoming JSON body sent by the mobile app / Lambda.
    Returns a plain Python dict.
    """
    if content_type != "application/json":
        raise ValueError(f"Unsupported content type: {content_type}")
    return json.loads(request_body)


def predict_fn(input_data: dict, model):
    """
    Run inference using the same predict() logic as the local server.
    `model` here is the artifact dict returned by model_fn.
    """
    # Temporarily set the artifact so serve.py's get_artifact()
    # returns our already-loaded artifact (avoids re-loading from disk)
    import classifiers.src.serve as serve_module
    serve_module._artifact = model

    return serve_module.predict(input_data)


def output_fn(prediction: dict, accept: str = "application/json"):
    """
    Serialize the prediction dict to a JSON string for HTTP response.
    """
    return json.dumps(prediction), "application/json"
