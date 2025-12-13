"""Tracing bootstrap helpers for Eden evaluation utilities."""

from __future__ import annotations

import os
from typing import Optional

from azure.core.settings import settings

from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter

_INITIALIZED = False


def _strtobool(value: str) -> bool:
    return value.lower() in {"1", "true", "yes", "y", "on"}


def ensure_tracing(*, force: bool = False) -> None:
    """Enable OpenTelemetry tracing for Azure SDK calls when requested.

    Tracing is activated when the environment variable ``EDEN_TRACING_ENABLED``
    evaluates to true (1/true/yes/on). Users can optionally override the OTLP
    endpoint and service name via the following environment variables:

    - ``EDEN_TRACING_ENDPOINT`` (default: ``http://localhost:4318/v1/traces``)
    - ``EDEN_TRACING_SERVICE`` (default: ``eden-viewer``)

    The bootstrap is idempotent so repeated calls are cheap.
    """

    global _INITIALIZED
    if _INITIALIZED and not force:
        return

    enabled = os.environ.get("EDEN_TRACING_ENABLED", "").strip()
    if not force and (not enabled or not _strtobool(enabled)):
        return

    # Configure Azure SDK to emit OpenTelemetry spans.
    settings.tracing_implementation = "opentelemetry"
    os.environ.setdefault("AZURE_TRACING_GEN_AI_INCLUDE_BINARY_DATA", "true")

    endpoint = os.environ.get("EDEN_TRACING_ENDPOINT", "http://localhost:4318/v1/traces")
    service_name = os.environ.get("EDEN_TRACING_SERVICE", "eden-viewer")

    resource = Resource(attributes={"service.name": service_name})
    provider = TracerProvider(resource=resource)

    otlp_exporter = OTLPSpanExporter(endpoint=endpoint)
    processor = BatchSpanProcessor(otlp_exporter)
    provider.add_span_processor(processor)
    trace.set_tracer_provider(provider)

    # Attempt to instrument Azure AI Projects SDK when available. This is
    # wrapped in a try/except so tracing still functions without the optional
    # dependency.
    try:
        from azure.ai.projects.telemetry import AIProjectInstrumentor  # type: ignore
    except ImportError:
        AIProjectInstrumentor = None  # type: ignore

    if AIProjectInstrumentor is not None:
        AIProjectInstrumentor().instrument(enable_content_recording=True)

    _INITIALIZED = True


__all__ = ["ensure_tracing"]
