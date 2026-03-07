# ============================================================
# scripts/deploy_sagemaker.py
# ============================================================
# WHAT THIS SCRIPT DOES:
#   1. Uploads your trained model artifact to S3
#   2. Launches a SageMaker training job (Script Mode)
#      OR skips training if you already have a local model
#   3. Deploys the model to a real-time endpoint
#
# PREREQUISITES (run once manually):
#   pip install boto3 sagemaker
#   aws configure   ← sets your AWS credentials
#
# RUN:
#   python scripts/deploy_sagemaker.py \
#     --bucket your-s3-bucket-name \
#     --role   arn:aws:iam::123456789:role/SageMakerExecutionRole
# ============================================================

import argparse
import os
import tarfile
import boto3
import sagemaker
from sagemaker.sklearn.estimator import SKLearn

# ------------------------------------------------------------------ #
#  Parse args
# ------------------------------------------------------------------ #
parser = argparse.ArgumentParser()
parser.add_argument("--bucket", required=True, help="S3 bucket name")
parser.add_argument("--role",   required=True, help="SageMaker IAM role ARN")
parser.add_argument(
    "--skip-training", action="store_true",
    help="Skip SageMaker training; upload existing local model artifact instead"
)
args = parser.parse_args()

BUCKET          = args.bucket
ROLE            = args.role
PREFIX          = "prosper-ml"
ENDPOINT_NAME   = "prosper-risk-endpoint"
REGION          = boto3.session.Session().region_name

session        = sagemaker.Session()
s3_client      = boto3.client("s3", region_name=REGION)

# ------------------------------------------------------------------ #
#  OPTION A — Run SageMaker training job
# ------------------------------------------------------------------ #
def run_training_job():
    """
    SageMaker Script Mode:
    - Uploads your src/ code to S3
    - Spins up a managed training instance (ml.m5.xlarge)
    - Runs src/train.py on that instance
    - Saves the model artifact to S3 automatically

    The instance costs ~$0.23/hr; 4k rows will finish in < 2 minutes.
    """
    print("[deploy] Uploading training data to S3...")
    for split in ["train.csv", "val.csv", "test.csv"]:
        local_path = os.path.join("data", split)
        s3_key     = f"{PREFIX}/data/{split}"
        s3_client.upload_file(local_path, BUCKET, s3_key)
        print(f"  Uploaded {local_path} → s3://{BUCKET}/{s3_key}")

    train_input = f"s3://{BUCKET}/{PREFIX}/data"

    estimator = SKLearn(
        entry_point       = "train.py",
        source_dir        = "src",              # uploads entire src/ folder
        role              = ROLE,
        instance_type     = "ml.m5.xlarge",
        instance_count    = 1,
        framework_version = "1.2-1",
        py_version        = "py3",
        output_path       = f"s3://{BUCKET}/{PREFIX}/model-artifacts",
        hyperparameters   = {},                 # controlled via config.py
        sagemaker_session = session,
    )

    print("[deploy] Starting SageMaker training job...")
    estimator.fit({"train": train_input}, wait=True, logs="All")
    print("[deploy] Training complete.")
    return estimator


# ------------------------------------------------------------------ #
#  OPTION B — Upload existing local model artifact
# ------------------------------------------------------------------ #
def upload_local_model():
    """
    If you trained locally and just want to deploy to SageMaker,
    package and upload the joblib file. SageMaker expects a .tar.gz.
    """
    print("[deploy] Packaging local model artifact...")
    tar_path = "models/prosper_pipeline.tar.gz"
    with tarfile.open(tar_path, "w:gz") as tar:
        tar.add("models/prosper_pipeline.joblib", arcname="prosper_pipeline.joblib")
        tar.add("src/",                           arcname="src")   # includes inference.py

    s3_key = f"{PREFIX}/model-artifacts/prosper_pipeline.tar.gz"
    s3_client.upload_file(tar_path, BUCKET, s3_key)
    print(f"[deploy] Uploaded to s3://{BUCKET}/{s3_key}")
    return f"s3://{BUCKET}/{s3_key}"


# ------------------------------------------------------------------ #
#  Deploy endpoint
# ------------------------------------------------------------------ #
def deploy_endpoint(estimator_or_model_uri):
    """
    Deploy to a real-time SageMaker endpoint.
    ml.t2.medium costs ~$0.046/hr — cheapest option for low traffic.
    Scale up to ml.m5.large if you expect concurrent requests.
    """
    print(f"[deploy] Deploying endpoint: {ENDPOINT_NAME}...")

    if isinstance(estimator_or_model_uri, str):
        # Deploying from a model artifact URI (Option B)
        from sagemaker.sklearn.model import SKLearnModel
        model = SKLearnModel(
            model_data        = estimator_or_model_uri,
            role              = ROLE,
            entry_point       = "inference.py",
            source_dir        = "src",
            framework_version = "1.2-1",
            sagemaker_session = session,
        )
        predictor = model.deploy(
            initial_instance_count = 1,
            instance_type          = "ml.t2.medium",
            endpoint_name          = ENDPOINT_NAME,
        )
    else:
        # Deploying from a fitted Estimator (Option A)
        predictor = estimator_or_model_uri.deploy(
            initial_instance_count = 1,
            instance_type          = "ml.t2.medium",
            endpoint_name          = ENDPOINT_NAME,
        )

    print(f"[deploy] ✅ Endpoint live: {ENDPOINT_NAME}")
    print(f"[deploy] Region: {REGION}")
    print(f"[deploy] Invoke via API Gateway → Lambda → SageMaker Runtime")
    return predictor


# ------------------------------------------------------------------ #
#  Main
# ------------------------------------------------------------------ #
if __name__ == "__main__":
    if args.skip_training:
        model_uri = upload_local_model()
        deploy_endpoint(model_uri)
    else:
        estimator = run_training_job()
        deploy_endpoint(estimator)
