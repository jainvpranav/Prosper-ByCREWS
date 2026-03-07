# Prosper ML Pipeline — Step-by-Step Commands

## Project Structure

```
prosper_ml/
├── data/               ← CSV files live here
├── models/             ← Saved pipeline artifact
│   └── output/         ← Metrics JSON + plots
├── src/
│   ├── config.py       ← All thresholds, paths, feature lists
│   ├── preprocessor.py ← Sklearn ColumnTransformer
│   ├── prepare_data.py ← Train/val/test split
│   ├── train.py        ← Full training pipeline (local + SageMaker)
│   ├── evaluate.py     ← Final test-set evaluation
│   ├── serve.py        ← FastAPI local inference server
│   └── inference.py    ← SageMaker inference entry point
└── scripts/
    ├── deploy_sagemaker.py  ← Launches training job + deploys endpoint
    └── lambda_handler.py    ← API Gateway → SageMaker bridge
```

---

## PHASE A — LOCAL SETUP & TRAINING

### Step 1 — Create and activate virtual environment

```bash
cd prosper_ml
python3 -m venv venv
source venv/bin/activate          # Mac/Linux
# venv\Scripts\activate           # Windows
```

### Step 2 — Install dependencies

```bash
pip install -r requirements.txt
```

> Expected: ~2 min download. If you see XGBoost CUDA warnings, ignore them.

### Step 3 — Place your dataset

```bash
# Copy your CSV into the data folder
cp /path/to/your/health_data.csv data/health_data.csv

# Verify columns match what the model expects
head -1 data/health_data.csv
# Expected columns: id,age,gender,bmi,daily_steps,sleep_hours,
# water_intake_l,calories_consumed,smoker,alcohol,
# resting_hr,systolic_bp,diastolic_bp,cholesterol,
# family_history,disease_risk
```

### Step 4 — Split into train / val / test

```bash
python src/prepare_data.py --input data/health_data.csv
```

**What you'll see:**
```
[prepare_data] Shape: (4000, 16)
[prepare_data] Target distribution:
0    3200
1     800
[prepare_data] Train: 2800 rows → data/train.csv
[prepare_data] Val:   600 rows  → data/val.csv
[prepare_data] Test:  600 rows  → data/test.csv
```

### Step 5 — Train the model

```bash
python src/train.py
```

**What you'll see (in order):**
```
[train] Loading train and validation data...
[train] Fitting preprocessor on training data...
[train] Applying SMOTE to balance classes...
[train] After SMOTE: {0: 2800, 1: 2800}
[train] Training XGBoost classifier...
[0]     validation_0-logloss: 0.65432
[50]    validation_0-logloss: 0.41230
[100]   validation_0-logloss: 0.38891
...
[train] Best iteration: 187
[train] Calibrating probabilities with Platt Scaling...
[train] Evaluating on validation set...

[train] AUC-ROC: 0.8734
              precision  recall  f1-score   support
           0       0.91    0.88      0.89       480
           1       0.71    0.77      0.74       120

[train] SHAP plot saved to models/output/shap_importance.png
[train] Pipeline saved to models/prosper_pipeline.joblib
[train] ✅ Training complete.
```

**Output files created:**
- `models/prosper_pipeline.joblib`  ← the model artifact
- `models/output/metrics.json`      ← AUC, precision, recall, F1
- `models/output/confusion_matrix.png`
- `models/output/shap_importance.png`

### Step 6 — Evaluate on the test set

```bash
python src/evaluate.py
```

**What you'll see:**
```
[evaluate] AUC-ROC: 0.8691    ← should be close to validation AUC
[evaluate] Sample predictions:
   age   bmi  smoker  risk_probability risk_category
0   45  28.5       0            0.3120           Low
1   62  33.1       1            0.7845          High
2   38  22.4       0            0.2341           Low
```

> If test AUC is >> 5 points lower than val AUC, the model is
> overfitting. Reduce `max_depth` in config.py and retrain.

### Step 7 — Start local inference server

```bash
uvicorn src.serve:app --reload --port 8000
```

**Test the endpoint:**

```bash
# Health check
curl http://localhost:8000/health

# Predict
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{
    "age": 45,
    "gender": "Male",
    "bmi": 28.5,
    "daily_steps": 4000,
    "sleep_hours": 5.5,
    "water_intake_l": 1.5,
    "calories_consumed": 2800,
    "smoker": 1,
    "alcohol": 1,
    "resting_hr": 90,
    "systolic_bp": 145,
    "diastolic_bp": 95,
    "cholesterol": 240,
    "family_history": 1
  }'
```

**Expected response:**
```json
{
  "risk_probability": 0.7823,
  "risk_category": "High",
  "top_factors": [
    {"feature": "systolic_bp",    "impact": 0.3120},
    {"feature": "cholesterol",    "impact": 0.2841},
    {"feature": "family_history", "impact": 0.1932}
  ]
}
```

**Interactive API docs (Swagger UI):**
Open → http://localhost:8000/docs

---

## PHASE B — AWS SAGEMAKER DEPLOYMENT

### Prerequisites (one-time setup)

```bash
# Install AWS tools
pip install boto3 sagemaker awscli

# Configure AWS credentials
aws configure
# Enter: AWS Access Key ID, Secret Access Key, Region (e.g. ap-south-1)

# Verify credentials work
aws sts get-caller-identity
```

### Step 8 — Create S3 bucket

```bash
# Replace with your unique bucket name
aws s3 mb s3://prosper-ml-bucket --region ap-south-1
```

### Step 9 — Create SageMaker IAM role (one-time)

```bash
# In AWS Console:
# IAM → Roles → Create Role → SageMaker → AmazonSageMakerFullAccess
# Copy the ARN: arn:aws:iam::YOUR_ACCOUNT_ID:role/SageMakerExecutionRole
```

### Step 10 — Option A: Train in SageMaker + Deploy

```bash
# This uploads your data to S3, runs training on ml.m5.xlarge,
# then deploys to a real-time endpoint.
python scripts/deploy_sagemaker.py \
  --bucket prosper-ml-bucket \
  --role   arn:aws:iam::YOUR_ACCOUNT_ID:role/SageMakerExecutionRole
```

### Step 10 — Option B: Deploy your locally-trained model

```bash
# If training locally was fine and you just want to deploy the
# existing models/prosper_pipeline.joblib to SageMaker:
python scripts/deploy_sagemaker.py \
  --bucket prosper-ml-bucket \
  --role   arn:aws:iam::YOUR_ACCOUNT_ID:role/SageMakerExecutionRole \
  --skip-training
```

### Step 11 — Set up API Gateway + Lambda

```bash
# 1. Package the Lambda function
cd scripts
zip lambda.zip lambda_handler.py
cd ..

# 2. Create Lambda function in AWS Console:
#    Lambda → Create Function → Python 3.11
#    Upload lambda.zip
#    Set env var: ENDPOINT_NAME = prosper-risk-endpoint
#    Attach IAM role with AmazonSageMakerFullAccess

# 3. Create API Gateway:
#    API Gateway → REST API → Create
#    POST /predict → Integration: Lambda Function → your lambda
#    Deploy to stage: prod
#    Copy the invoke URL: https://XXXXX.execute-api.ap-south-1.amazonaws.com/prod

# 4. Test the live endpoint:
curl -X POST https://XXXXX.execute-api.ap-south-1.amazonaws.com/prod/predict \
  -H "Content-Type: application/json" \
  -d '{"age":45,"gender":"Male","bmi":28.5,"daily_steps":4000,
       "sleep_hours":5.5,"water_intake_l":1.5,"calories_consumed":2800,
       "smoker":1,"alcohol":1,"resting_hr":90,"systolic_bp":145,
       "diastolic_bp":95,"cholesterol":240,"family_history":1}'
```

### Step 12 — Clean up (avoid surprise AWS charges)

```bash
# Delete endpoint when not in use (can redeploy anytime)
aws sagemaker delete-endpoint --endpoint-name prosper-risk-endpoint

# To redeploy later:
python scripts/deploy_sagemaker.py --bucket prosper-ml-bucket \
  --role arn:aws:iam::YOUR_ACCOUNT_ID:role/SageMakerExecutionRole \
  --skip-training
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `Missing columns` error in prepare_data | Check CSV header matches exactly. Column names are case-sensitive. |
| AUC < 0.70 | Check class imbalance. Open `models/output/confusion_matrix.png`. Try lowering `max_depth` in config.py. |
| `Model file not found` in serve.py | Run `python src/train.py` first. |
| SageMaker training job fails | Check CloudWatch Logs in AWS Console → Log Groups → /aws/sagemaker/TrainingJobs |
| Lambda timeout | Increase Lambda timeout to 30s in AWS Console. First invocation can be slow (cold start). |

---

## Key Design Decisions

| Decision | Why |
|---|---|
| Binary classifier, not regression | Output is a category (Low/Med/High), not a continuous value |
| SMOTE on training data only | Applying to val/test would leak information and inflate metrics |
| Calibration with Platt Scaling | XGBoost probabilities can be overconfident; calibration makes p=0.7 actually mean 70% |
| SHAP for explanations | Powers "top factors" feature in the app; more reliable than feature_importances_ |
| config.py drives everything | One place to change thresholds, feature lists, paths — no hunting across files |
| serve.py predict() reused in inference.py | Single source of truth for inference logic across local + AWS |
