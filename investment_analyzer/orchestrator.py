"""Pipeline orchestrator.

Coordinates the six-agent pipeline across four stages:

    Stage 1 (sequential):  Data Collector
    Stage 2 (parallel):    Technical Analyst + Fundamental Analyst
    Stage 3 (parallel):    Bull Analyst + Bear Analyst
    Stage 4 (sequential):  Judge

Handles partial failures, retry policy, and progress reporting.
Implemented in Phase 7.
"""

from __future__ import annotations
