"""Thin wrapper around :mod:`yfinance`.

Exposes typed helpers that the Data Collector agent uses:

    * fetch_profile(ticker)
    * fetch_price_history(ticker, period)
    * fetch_financials(ticker)
    * fetch_news(ticker, days)

All helpers support a ``use_fixture`` mode so tests can run offline.

Implemented in Phase 4.
"""

from __future__ import annotations
