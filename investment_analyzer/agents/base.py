"""Base agent framework.

Provides :class:`BaseAgent`, a generic abstract class that all six
agents inherit from. It handles:

    * Loading the per-agent system prompt from ``agents/prompts/``.
    * Constructing the Anthropic ``messages.create`` call.
    * Using tool-use to enforce structured Pydantic output.
    * Retry with exponential backoff on transient errors.
    * Structured JSONL logging of every invocation.

Implemented in Phase 5.
"""

from __future__ import annotations
