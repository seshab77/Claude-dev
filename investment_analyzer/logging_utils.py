"""Structured logging utilities.

Each run produces ``logs/run_<YYYYMMDD_HHMMSS>_<TICKER>.jsonl`` containing
one JSON-per-line record for every agent invocation (input summary,
output summary, latency, tokens, status).
"""

from __future__ import annotations
