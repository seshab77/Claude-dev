"""Technical indicator calculators.

Computes indicators directly from a price series using :mod:`pandas`
(no heavy third-party TA dependency). Indicators include:

    * Simple moving averages (SMA)
    * Exponential moving averages (EMA)
    * Relative Strength Index (RSI)
    * MACD
    * Bollinger Bands
    * Basic support / resistance detection

Implemented in Phase 4.
"""

from __future__ import annotations
