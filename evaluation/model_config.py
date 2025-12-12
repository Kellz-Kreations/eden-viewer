import os
from typing import Optional


def load_azure_openai_model_config():
    """Best-effort model config loader.

    If env vars are missing, returns None and the evaluation will run only code-based checks.
    """

    endpoint = os.environ.get("AZURE_OPENAI_ENDPOINT")
    api_key = os.environ.get("AZURE_OPENAI_API_KEY")
    deployment = os.environ.get("AZURE_OPENAI_DEPLOYMENT")

    if not endpoint or not api_key or not deployment:
        return None

    # Import only when needed to keep non-LLM evals lightweight.
    from azure.ai.evaluation import AzureOpenAIModelConfiguration

    return AzureOpenAIModelConfiguration(
        azure_deployment=deployment,
        azure_endpoint=endpoint,
        api_key=api_key,
    )
