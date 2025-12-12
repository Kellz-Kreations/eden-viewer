import os
from pathlib import Path

# Allow running this file directly: `python evaluation/run.py ...`
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from azure.ai.evaluation import evaluate

from evaluation.evaluators import EnvFormatEvaluator, InstructionConstraintEvaluator
from evaluation.model_config import load_azure_openai_model_config
from evaluation.targets import chatbot_target, envgen_target


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def run_chatbot():
    data_path = _repo_root() / "evaluation" / "data" / "chatbot.jsonl"
    out_dir = _repo_root() / "evaluation" / "out"
    out_dir.mkdir(parents=True, exist_ok=True)

    evaluators = {
        "constraints": InstructionConstraintEvaluator(),
    }

    model_config = load_azure_openai_model_config()
    if model_config is not None:
        # Optional LLM-judged metrics.
        from azure.ai.evaluation import RelevanceEvaluator, TaskAdherenceEvaluator

        evaluators["relevance"] = RelevanceEvaluator(model_config=model_config)
        evaluators["task_adherence"] = TaskAdherenceEvaluator(model_config=model_config)

        evaluator_config = {
            "relevance": {"column_mapping": {"query": "${data.query}", "response": "${target.response}"}},
            "task_adherence": {"column_mapping": {"query": "${data.query}", "response": "${target.response}"}},
            "constraints": {"column_mapping": {"query": "${data.query}", "response": "${target.response}"}},
        }
    else:
        evaluator_config = {
            "constraints": {"column_mapping": {"query": "${data.query}", "response": "${target.response}"}},
        }

    result = evaluate(
        data=str(data_path),
        target=chatbot_target,
        evaluators=evaluators,
        evaluator_config=evaluator_config,
        output_path=str(out_dir / "chatbot_results.json"),
        evaluation_name="eden-viewer-chatbot",
    )

    print("Wrote:", out_dir / "chatbot_results.json")
    if isinstance(result, dict):
        print("Metrics:", result.get("metrics"))
    else:
        print("Metrics:", getattr(result, "metrics", None))


def run_envgen():
    data_path = _repo_root() / "evaluation" / "data" / "envgen.jsonl"
    out_dir = _repo_root() / "evaluation" / "out"
    out_dir.mkdir(parents=True, exist_ok=True)

    evaluators = {
        "env_format": EnvFormatEvaluator(),
    }

    evaluator_config = {
        "env_format": {
            "column_mapping": {
                "response": "${target.response}",
                "expected_appdata_root": "${data.expected_appdata_root}",
                "expected_data_root": "${data.expected_data_root}",
                "expected_transcode_root": "${data.expected_transcode_root}",
                "expected_puid": "${data.expected_puid}",
                "expected_pgid": "${data.expected_pgid}",
                "expected_tz": "${data.expected_tz}",
            }
        }
    }

    result = evaluate(
        data=str(data_path),
        target=envgen_target,
        evaluators=evaluators,
        evaluator_config=evaluator_config,
        output_path=str(out_dir / "envgen_results.json"),
        evaluation_name="eden-viewer-envgen",
    )

    print("Wrote:", out_dir / "envgen_results.json")
    if isinstance(result, dict):
        print("Metrics:", result.get("metrics"))
    else:
        print("Metrics:", getattr(result, "metrics", None))


def main():
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("suite", choices=["chatbot", "envgen"], help="Which evaluation suite to run")
    args = parser.parse_args()

    if args.suite == "chatbot":
        run_chatbot()
    else:
        run_envgen()


if __name__ == "__main__":
    main()
