"""Interactive CLI for the Investment Analyzer.

Responsibilities:
    * Prompt the user for a ticker, analysis depth, and output preferences.
    * Invoke :class:`investment_analyzer.orchestrator.Orchestrator`.
    * Render the resulting report via :mod:`investment_analyzer.rendering`.
    * Offer a post-analysis menu (follow-up question, another ticker, exit).

Implemented in Phase 9.
"""

from __future__ import annotations
