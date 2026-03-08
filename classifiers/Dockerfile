# classifiers/Dockerfile

FROM python:3.10-slim

WORKDIR /app

# Install AWS CLI (needed to download model from S3)
RUN apt-get update && \
    apt-get install -y awscli && \
    rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY src/ ./src/

# Model will be downloaded from S3 at startup
ENV MODEL_S3_URI=""

EXPOSE 8000

CMD ["sh", "-c", "\
mkdir -p /app/models && \
aws s3 cp $MODEL_S3_URI /app/models/prosper_pipeline.joblib && \
uvicorn src.server:app --host 0.0.0.0 --port 8000 --workers 2 \
"]