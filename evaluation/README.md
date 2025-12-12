# Evaluation

This folder scaffolds an evaluation framework for:
- **A)** a setup **chatbot/agent** that answers Synology/Docker questions
- **B)** a **.env generator** prompt/workflow

It uses `azure-ai-evaluation` and supports:
- **Code-based checks** that run anywhere (no model required)
- **Optional prompt-based evaluators** (TaskAdherence/Relevance/etc) if you provide an Azure OpenAI configuration

## Setup

```powershell
python -m venv .\.venv-eval
.\.venv-eval\Scripts\python -m pip install --upgrade pip
.\.venv-eval\Scripts\pip install -r .\evaluation\requirements.txt
```

## Configure your target (agent entrypoint)

The eval runner can call your agent via **HTTP** or **CLI**.

### Option 1: HTTP endpoint
Set:
- `EDEN_AGENT_MODE=http`
- `EDEN_AGENT_HTTP_URL` (e.g. `http://127.0.0.1:8000/chat`)

Expected HTTP request body:
```json
{ "query": "..." }
```
Expected response body:
```json
{ "response": "..." }
```

### Option 2: CLI command
Set:
- `EDEN_AGENT_MODE=cmd`
- `EDEN_AGENT_CMD` (e.g. `python -m my_agent --stdin`)

The runner will pass the query on stdin and expects stdout to be the response.

### Option 3: Stub
Default:
- `EDEN_AGENT_MODE=stub`

This lets you validate the evaluation plumbing before your agent exists.

## (Optional) Enable prompt-based evaluators

If you want LLM-judged metrics (task adherence/relevance), set:
- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_DEPLOYMENT`

## Run evaluations

### A) Chatbot evaluation
```powershell
.\.venv-eval\Scripts\python .\evaluation\run.py chatbot
```

### B) .env generation evaluation
```powershell
.\.venv-eval\Scripts\python .\evaluation\run.py envgen
```

Outputs are written under `evaluation/out/`.
