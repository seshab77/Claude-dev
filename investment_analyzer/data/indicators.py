"""Technical indicator calculators.

Pure-pandas implementations of the core indicators the Technical
Analyst agent consumes. Each function accepts a pandas Series of
closing prices (or DataFrame for volume-aware indicators) and
returns a Series aligned to the same index.

All indicators follow common definitions — tests in
``tests/test_indicators.py`` pin behavior against known values.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

import pandas as pd


def sma(close: pd.Series, window: int) -> pd.Series:
    """Simple moving average."""
    return close.rolling(window=window, min_periods=window).mean()


def ema(close: pd.Series, window: int) -> pd.Series:
    """Exponential moving average (pandas ``adjust=False`` convention)."""
    return close.ewm(span=window, adjust=False, min_periods=window).mean()


def rsi(close: pd.Series, period: int = 14) -> pd.Series:
    """Relative Strength Index using Wilder's smoothing.

    When there are no losses in the lookback window RSI saturates
    to 100 (pure uptrend). When there are no gains it saturates
    to 0.
    """
    import numpy as np

    delta = close.diff()
    gain = delta.clip(lower=0.0)
    loss = -delta.clip(upper=0.0)
    # Wilder smoothing ~= EMA with alpha = 1/period
    avg_gain = gain.ewm(alpha=1 / period, adjust=False, min_periods=period).mean()
    avg_loss = loss.ewm(alpha=1 / period, adjust=False, min_periods=period).mean()
    rs = avg_gain / avg_loss.replace(0.0, np.nan)
    out = 100.0 - (100.0 / (1.0 + rs))
    # If avg_loss is exactly zero (all gains), RSI is defined as 100.
    out = out.where(~((avg_loss == 0) & (avg_gain > 0)), 100.0)
    # If avg_gain is zero (all losses), RSI is 0.
    out = out.where(~((avg_gain == 0) & (avg_loss > 0)), 0.0)
    return out.astype("float64")


@dataclass
class MACDResult:
    macd: pd.Series
    signal: pd.Series
    histogram: pd.Series


def macd(
    close: pd.Series,
    fast: int = 12,
    slow: int = 26,
    signal_period: int = 9,
) -> MACDResult:
    """Moving Average Convergence Divergence."""
    fast_ema = ema(close, fast)
    slow_ema = ema(close, slow)
    macd_line = fast_ema - slow_ema
    signal_line = macd_line.ewm(
        span=signal_period, adjust=False, min_periods=signal_period
    ).mean()
    histogram = macd_line - signal_line
    return MACDResult(macd=macd_line, signal=signal_line, histogram=histogram)


@dataclass
class BollingerResult:
    middle: pd.Series
    upper: pd.Series
    lower: pd.Series


def bollinger_bands(
    close: pd.Series, window: int = 20, num_std: float = 2.0
) -> BollingerResult:
    """Bollinger Bands (SMA +/- N standard deviations)."""
    middle = sma(close, window)
    std = close.rolling(window=window, min_periods=window).std(ddof=0)
    upper = middle + num_std * std
    lower = middle - num_std * std
    return BollingerResult(middle=middle, upper=upper, lower=lower)


def support_resistance(
    close: pd.Series, lookback: int = 60, levels: int = 3
) -> tuple[list[float], list[float]]:
    """Naive support/resistance via local minima/maxima in the
    recent window. For v1 we return up to ``levels`` distinct
    values rounded to two decimals — good enough for an LLM to
    interpret without pretending to be a real chart reader.
    """
    if close.empty:
        return [], []
    recent = close.tail(lookback).dropna()
    if recent.empty:
        return [], []

    lows = sorted(set(round(float(x), 2) for x in recent.nsmallest(levels * 2)))
    highs = sorted(
        set(round(float(x), 2) for x in recent.nlargest(levels * 2)), reverse=True
    )
    return lows[:levels], highs[:levels]


@dataclass
class IndicatorBundle:
    """Everything the Technical Analyst receives at once."""

    latest_close: Optional[float] = None
    sma: dict[int, Optional[float]] = field(default_factory=dict)
    ema: dict[int, Optional[float]] = field(default_factory=dict)
    rsi: Optional[float] = None
    macd: Optional[float] = None
    macd_signal: Optional[float] = None
    macd_histogram: Optional[float] = None
    bb_upper: Optional[float] = None
    bb_middle: Optional[float] = None
    bb_lower: Optional[float] = None
    support_levels: list[float] = field(default_factory=list)
    resistance_levels: list[float] = field(default_factory=list)

    def to_dict(self) -> dict[str, object]:
        """Compact dict for logging and LLM tool-input payloads."""
        return {
            "latest_close": self.latest_close,
            "sma": {str(k): v for k, v in self.sma.items()},
            "ema": {str(k): v for k, v in self.ema.items()},
            "rsi": self.rsi,
            "macd": self.macd,
            "macd_signal": self.macd_signal,
            "macd_histogram": self.macd_histogram,
            "bb_upper": self.bb_upper,
            "bb_middle": self.bb_middle,
            "bb_lower": self.bb_lower,
            "support_levels": self.support_levels,
            "resistance_levels": self.resistance_levels,
        }


def _last(series: pd.Series) -> Optional[float]:
    if series is None or series.empty:
        return None
    val = series.iloc[-1]
    if pd.isna(val):
        return None
    return float(val)


def compute_indicators(
    close: pd.Series,
    sma_windows: list[int] | None = None,
    ema_windows: list[int] | None = None,
    rsi_period: int = 14,
    macd_fast: int = 12,
    macd_slow: int = 26,
    macd_signal: int = 9,
    bb_window: int = 20,
    bb_std: float = 2.0,
) -> IndicatorBundle:
    """Compute every indicator at the latest bar into a single bundle.

    ``close`` must be a pandas Series of closing prices indexed by date.
    NaNs at the head of each indicator are expected (warm-up period).
    """
    sma_windows = sma_windows or [20, 50, 200]
    ema_windows = ema_windows or [12, 26]

    bundle = IndicatorBundle(latest_close=_last(close))

    for w in sma_windows:
        bundle.sma[w] = _last(sma(close, w))
    for w in ema_windows:
        bundle.ema[w] = _last(ema(close, w))

    bundle.rsi = _last(rsi(close, rsi_period))

    macd_res = macd(close, macd_fast, macd_slow, macd_signal)
    bundle.macd = _last(macd_res.macd)
    bundle.macd_signal = _last(macd_res.signal)
    bundle.macd_histogram = _last(macd_res.histogram)

    bb = bollinger_bands(close, bb_window, bb_std)
    bundle.bb_upper = _last(bb.upper)
    bundle.bb_middle = _last(bb.middle)
    bundle.bb_lower = _last(bb.lower)

    supports, resistances = support_resistance(close)
    bundle.support_levels = supports
    bundle.resistance_levels = resistances

    return bundle
