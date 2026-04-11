"""Markdown report writer.

Saves the detailed 10-section report to
``reports/<TICKER>_<YYYYMMDD_HHMMSS>.md``.

Report sections:
    1. Header (ticker, company, price, date)
    2. Executive Summary (verdict + rationale)
    3. Company Snapshot
    4. Key Metrics Table
    5. Technical Analysis
    6. Fundamental Analysis
    7. Bull Thesis
    8. Bear Thesis
    9. Final Recommendation
   10. Data Sources & Disclaimer

Implemented in Phase 8.
"""

from __future__ import annotations
