import boto3
import json
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

client = boto3.client("bedrock-agent-runtime")

MARKDOWN_SYSTEM_PREFIX = (
    "You are Pip, a friendly AI health companion. "
    "Always respond using well-structured Markdown. "
    "Use headings (##, ###) to organise sections, "
    "bullet points or numbered lists for steps or items, "
    "**bold** for important terms, and code blocks where appropriate. "
    "Keep responses concise and easy to read in a chat UI.\n\n"
    "User question: "
)

def lambda_handler(event, context):

    try:
        # Log full event for debugging
        logger.info("Full Event: %s", json.dumps(event))

        # ---------------------------------------------------------------
        # API Gateway wraps the HTTP POST body as a JSON *string* under
        # event["body"].  We must parse it before we can read our fields.
        # We also fall back to reading fields directly from the event root
        # (useful for direct Lambda test invocations).
        # ---------------------------------------------------------------
        raw_body = event.get("body")
        logger.info("Raw body from event: %s", raw_body)

        if raw_body:
            try:
                body = json.loads(raw_body)
                logger.info("Parsed body: %s", json.dumps(body))
            except (json.JSONDecodeError, TypeError) as parse_err:
                logger.warning("Could not parse event body as JSON: %s", parse_err)
                body = {}
        else:
            # Direct Lambda invocation — fields may be at the top level
            body = event

        # Look for the prompt in all expected locations
        input_text = (
            body.get("inputText")           # chatService.ts sends this key
            or body.get("prompt")
            or event.get("inputText")       # fallback: direct invocation
            or event.get("prompt")
        )

        logger.info("Extracted user prompt: %s", input_text)

        if not input_text:
            logger.error("No prompt found. Event keys: %s | Body keys: %s",
                         list(event.keys()), list(body.keys()))

        user_prompt = input_text or ""

        # Build the final prompt: system instructions + user question
        prompt = MARKDOWN_SYSTEM_PREFIX + user_prompt
        logger.info("Final Prompt Sent to Bedrock: %s", prompt)

        response = client.retrieve_and_generate(
            input={
                "text": prompt
            },
            retrieveAndGenerateConfiguration={
                "type": "KNOWLEDGE_BASE",
                "knowledgeBaseConfiguration": {
                    "knowledgeBaseId": "UJJUMNOCLJ",
                    "modelArn": "arn:aws:bedrock:ap-south-1:514348993212:inference-profile/apac.amazon.nova-micro-v1:0"
                }
            }
        )

        logger.info("Bedrock Raw Response: %s", json.dumps(response))

        result_text = response["output"]["text"]
        session_id = response["sessionId"]

        logger.info("Generated Response: %s", result_text)
        logger.info("Session ID: %s", session_id)

        return {
            "statusCode": 200,
            "body": json.dumps({
                "response": result_text,
                "sessionId": session_id
            })
        }

    except Exception as e:
        logger.error("Lambda Error: %s", str(e))

        return {
            "statusCode": 500,
            "body": json.dumps({
                "error": str(e)
            })
        }
