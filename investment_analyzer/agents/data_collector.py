"""Agent 1 — Data Collector.

Uses the data layer (yfinance + SEC EDGAR) to assemble a
:class:`ResearchPacket` of raw facts. This agent does NOT analyze
or opine; it only orchestrates data fetching, flags gaps, and
normalizes results into a structured packet.

Implemented in Phase 6 (Step 1).
"""

from __future__ import annotations
