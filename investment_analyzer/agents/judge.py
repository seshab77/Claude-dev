"""Agent 6 — Judge / Synthesizer.

Weighs bull and bear theses against technical and fundamental
signals, reconciles disagreements, and produces a
:class:`FinalRecommendation` (Strong Buy / Buy / Hold / Sell /
Strong Sell) with a confidence score, rationale, key risks to
monitor, and an intended time horizon.

The Judge also handles follow-up questions in the interactive
post-analysis menu by reusing the full report as context.

Implemented in Phase 6 (Step 6).
"""

from __future__ import annotations
