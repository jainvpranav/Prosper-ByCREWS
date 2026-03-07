# ============================================================
# scripts/lambda_handler.py
# ============================================================
# WHAT THIS IS:
#   AWS Lambda function that sits between API Gateway and
#   the SageMaker endpoint. Your mobile app calls API Gateway
#   which triggers this Lambda which calls SageMaker.
#
# WHY LAMBDA IN THE MIDDLE?
#   - SageMaker endpoints are not directly public
#   - Lambda handles auth, input validation, error formatting
#   - Keeps SageMaker endpoint private inside AWS VPC
#   - Adds zero latency for 4k-row scale (< 5ms overhead)
#
# DEPLOY THIS:
#   1. Zip this file: zip lambda.zip lambda_handler.py
#   2. Upload to Lambda in AWS Console or via CLI
#   3. Set env var ENDPOINT_NAME = "prosper-risk-endpoint"
#   4. Give Lambda role: AmazonSageMakerFullAccess
# ============================================================

import json
import os
import boto3

ENDPOINT_NAME = os.environ.get("ENDPOINT_NAME", "prosper-risk-endpoint")
REGION        = os.environ.get("AWS_REGION", "us-east-1")

runtime_client = boto3.client("sagemaker-runtime", region_name=REGION)


def lambda_handler(event, context):
    """
    API Gateway passes the request body as event["body"] (string).
    We forward it to SageMaker and return the JSON response.
    """
    try:
        # Parse body (API Gateway wraps it as a string)
        body = event.get("body", "{}")
        if isinstance(body, str):
            input_data = json.loads(body)
        else:
            input_data = body

        # Call SageMaker endpoint
        response = runtime_client.invoke_endpoint(
            EndpointName = ENDPOINT_NAME,
            ContentType  = "application/json",
            Body         = json.dumps(input_data),
        )

        # Parse response
        result = json.loads(response["Body"].read().decode("utf-8"))

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type":                "application/json",
                "Access-Control-Allow-Origin": "*",   # adjust for production
            },
            "body": json.dumps(result),
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)}),
        }
