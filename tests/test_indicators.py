"""Tests for technical indicator calculations."""

from __future__ import annotations

import math

import pandas as pd
import pytest

from investment_analyzer.data.indicators import (
    bollinger_bands,
    compute_indicators,
    ema,
    macd,
    rsi,
    sma,
    support_resistance,
)


@pytest.fixture
def rising_prices() -> pd.Series:
    """250 trading-day linearly rising price series."""
    return pd.Series(
        [100 + i * 0.5 for i in range(250)],
        index=pd.date_range("2024-01-01", periods=250, freq="B"),
    )


@pytest.fixture
def noisy_prices() -> pd.Series:
    """A mildly oscillating series so RSI stays between 0 and 100."""
    base = [100 + (i % 10 - 5) for i in range(250)]
    return pd.Series(
        base,
        index=pd.date_range("2024-01-01", periods=250, freq="B"),
    )


def test_sma_matches_rolling_mean(rising_prices):
    s = sma(rising_prices, 20)
    # First 19 values are NaN (warm-up).
    assert s.iloc[:19].isna().all()
    # SMA(20) at index 19 = mean of first 20 values.
    assert s.iloc[19] == pytest.approx(rising_prices.iloc[:20].mean())
    # Final value on an arithmetic progression equals midpoint.
    expected = rising_prices.iloc[-20:].mean()
    assert s.iloc[-1] == pytest.approx(expected)


def test_ema_has_correct_warmup(rising_prices):
    e = ema(rising_prices, 12)
    assert e.iloc[:11].isna().all()
    assert not math.isnan(e.iloc[11])


def test_rsi_saturates_to_100_on_pure_uptrend(rising_prices):
    r = rsi(rising_prices, period=14)
    # With strictly rising prices, RSI must equal 100 at the final bar.
    assert r.iloc[-1] == pytest.approx(100.0)


def test_rsi_bounded(noisy_prices):
    r = rsi(noisy_prices, period=14).dropna()
    assert ((r >= 0) & (r <= 100)).all()


def test_macd_signal_lags_macd_line(rising_prices):
    res = macd(rising_prices)
    # On a steady linear trend, MACD line and signal eventually
    # converge to the same slope.
    assert res.macd.iloc[-1] == pytest.approx(res.signal.iloc[-1], abs=1e-3)
    # Histogram ~ 0 at steady state.
    assert abs(res.histogram.iloc[-1]) < 1e-3


def test_bollinger_bands_bracket_middle(rising_prices):
    res = bollinger_bands(rising_prices, window=20, num_std=2.0)
    # Upper > middle > lower for every non-NaN row.
    valid = res.middle.dropna().index
    assert (res.upper.loc[valid] > res.middle.loc[valid]).all()
    assert (res.lower.loc[valid] < res.middle.loc[valid]).all()


def test_support_and_resistance_ordering(noisy_prices):
    supports, resistances = support_resistance(noisy_prices, lookback=60, levels=3)
    assert len(supports) <= 3
    assert len(resistances) <= 3
    # Supports should be below resistances on average.
    assert max(supports) <= max(resistances)


def test_compute_indicators_populates_bundle(rising_prices):
    bundle = compute_indicators(rising_prices)
    assert bundle.latest_close == pytest.approx(rising_prices.iloc[-1])
    assert bundle.sma[20] is not None
    assert bundle.sma[50] is not None
    assert bundle.sma[200] is not None
    assert bundle.ema[12] is not None
    assert bundle.rsi is not None
    assert bundle.macd is not None
    assert bundle.bb_upper is not None
    assert bundle.bb_lower is not None
    assert bundle.bb_upper > bundle.bb_middle > bundle.bb_lower
    assert len(bundle.support_levels) > 0
    assert len(bundle.resistance_levels) > 0


def test_compute_indicators_to_dict_roundtrip(rising_prices):
    bundle = compute_indicators(rising_prices)
    d = bundle.to_dict()
    assert d["latest_close"] == pytest.approx(rising_prices.iloc[-1])
    assert "20" in d["sma"]
    assert d["rsi"] == bundle.rsi
