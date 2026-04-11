"""Thin wrapper around :mod:`yfinance`.

Every helper accepts a ``fixture_path`` argument that bypasses the
network and loads a cached JSON response. This lets the test suite
run entirely offline and makes development cheap when iterating on
agent prompts.

The real ``yfinance`` import is deferred into the method bodies so
importing this module never requires the dependency; tests that
use fixtures can run without yfinance installed.
"""

from __future__ import annotations

import json
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from ..models.research import (
    CompanyProfile,
    EarningsInfo,
    Financials,
    FinancialStatement,
    KeyMetrics,
    NewsItem,
    PricePoint,
    PriceSeries,
)


class YFinanceError(RuntimeError):
    """Raised when a yfinance call fails and there is no usable fixture."""


# --------------------------------------------------------------------------- #
# Fixture loading
# --------------------------------------------------------------------------- #


def _load_fixture(fixture_path: str | Path) -> dict:
    path = Path(fixture_path)
    if not path.exists():
        raise YFinanceError(f"Fixture not found: {path}")
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


# --------------------------------------------------------------------------- #
# Public API
# --------------------------------------------------------------------------- #


def fetch_profile(
    ticker: str, fixture_path: str | Path | None = None
) -> CompanyProfile:
    """Return basic company profile information for ``ticker``."""
    if fixture_path:
        data = _load_fixture(fixture_path)
        info = data.get("info", {})
    else:
        info = _live_info(ticker)

    return CompanyProfile(
        ticker=ticker.upper(),
        name=info.get("longName") or info.get("shortName") or ticker.upper(),
        sector=info.get("sector"),
        industry=info.get("industry"),
        country=info.get("country"),
        market_cap=_opt_float(info.get("marketCap")),
        employees=_opt_int(info.get("fullTimeEmployees")),
        website=info.get("website"),
        description=info.get("longBusinessSummary"),
    )


def fetch_price_history(
    ticker: str,
    lookback_days: int,
    fixture_path: str | Path | None = None,
) -> PriceSeries:
    """Return daily OHLCV for the last ``lookback_days`` calendar days."""
    if fixture_path:
        data = _load_fixture(fixture_path)
        rows = data.get("history", [])
    else:
        rows = _live_history(ticker, lookback_days)

    points: list[PricePoint] = []
    for row in rows:
        try:
            points.append(
                PricePoint(
                    date=_parse_date(row["date"]),
                    open=float(row["open"]),
                    high=float(row["high"]),
                    low=float(row["low"]),
                    close=float(row["close"]),
                    volume=int(row["volume"]),
                )
            )
        except (KeyError, TypeError, ValueError):
            continue

    return PriceSeries(ticker=ticker.upper(), period_days=lookback_days, points=points)


def fetch_financials(
    ticker: str, fixture_path: str | Path | None = None
) -> Financials:
    """Return income/balance/cash-flow statements (quarterly + annual)."""
    if fixture_path:
        data = _load_fixture(fixture_path)
        raw = data.get("financials", {})
    else:
        raw = _live_financials(ticker)

    return Financials(
        income_statements=_parse_statements(raw.get("income", [])),
        balance_sheets=_parse_statements(raw.get("balance", [])),
        cash_flow_statements=_parse_statements(raw.get("cashflow", [])),
    )


def fetch_key_metrics(
    ticker: str, fixture_path: str | Path | None = None
) -> KeyMetrics:
    """Return selected ratios and per-share metrics."""
    if fixture_path:
        data = _load_fixture(fixture_path)
        info = data.get("info", {})
    else:
        info = _live_info(ticker)

    return KeyMetrics(
        pe_ratio=_opt_float(info.get("trailingPE")),
        forward_pe=_opt_float(info.get("forwardPE")),
        pb_ratio=_opt_float(info.get("priceToBook")),
        peg_ratio=_opt_float(info.get("pegRatio")),
        eps_ttm=_opt_float(info.get("trailingEps")),
        revenue_growth_yoy=_opt_float(info.get("revenueGrowth")),
        earnings_growth_yoy=_opt_float(info.get("earningsGrowth")),
        gross_margin=_opt_float(info.get("grossMargins")),
        operating_margin=_opt_float(info.get("operatingMargins")),
        net_margin=_opt_float(info.get("profitMargins")),
        return_on_equity=_opt_float(info.get("returnOnEquity")),
        debt_to_equity=_opt_float(info.get("debtToEquity")),
        current_ratio=_opt_float(info.get("currentRatio")),
        dividend_yield=_opt_float(info.get("dividendYield")),
        beta=_opt_float(info.get("beta")),
    )


def fetch_news(
    ticker: str, days: int, fixture_path: str | Path | None = None
) -> list[NewsItem]:
    """Return news items published within the last ``days`` days."""
    if fixture_path:
        data = _load_fixture(fixture_path)
        rows = data.get("news", [])
    else:
        rows = _live_news(ticker)

    cutoff = datetime.now(tz=timezone.utc) - timedelta(days=days)
    out: list[NewsItem] = []
    for row in rows:
        published = _parse_datetime(row.get("published"))
        if published and published < cutoff:
            continue
        out.append(
            NewsItem(
                title=row.get("title", "(untitled)"),
                source=row.get("source"),
                url=row.get("url"),
                published=published,
                snippet=row.get("snippet"),
            )
        )
    return out


def fetch_earnings(
    ticker: str, fixture_path: str | Path | None = None
) -> EarningsInfo:
    """Return recent/next earnings dates and last surprise."""
    if fixture_path:
        data = _load_fixture(fixture_path)
        e = data.get("earnings", {})
    else:
        e = _live_earnings(ticker)

    return EarningsInfo(
        next_earnings_date=_opt_date(e.get("next_earnings_date")),
        last_earnings_date=_opt_date(e.get("last_earnings_date")),
        last_reported_eps=_opt_float(e.get("last_reported_eps")),
        last_estimated_eps=_opt_float(e.get("last_estimated_eps")),
        last_surprise_pct=_opt_float(e.get("last_surprise_pct")),
    )


# --------------------------------------------------------------------------- #
# Live implementations (deferred yfinance import)
# --------------------------------------------------------------------------- #


def _yf():
    try:
        import yfinance as yf  # type: ignore
    except ImportError as exc:
        raise YFinanceError(
            "yfinance is not installed; run `pip install yfinance` "
            "or pass fixture_path to use cached data."
        ) from exc
    return yf


def _live_info(ticker: str) -> dict:
    yf = _yf()
    try:
        return yf.Ticker(ticker).info or {}
    except Exception as exc:
        raise YFinanceError(f"yfinance info({ticker}) failed: {exc}") from exc


def _live_history(ticker: str, lookback_days: int) -> list[dict]:
    yf = _yf()
    try:
        period = _period_for_days(lookback_days)
        df = yf.Ticker(ticker).history(period=period, auto_adjust=False)
    except Exception as exc:
        raise YFinanceError(f"yfinance history({ticker}) failed: {exc}") from exc

    rows: list[dict] = []
    for idx, row in df.iterrows():
        rows.append(
            {
                "date": idx.date().isoformat(),
                "open": row.get("Open"),
                "high": row.get("High"),
                "low": row.get("Low"),
                "close": row.get("Close"),
                "volume": row.get("Volume") or 0,
            }
        )
    return rows


def _period_for_days(days: int) -> str:
    if days <= 7:
        return "5d"
    if days <= 30:
        return "1mo"
    if days <= 90:
        return "3mo"
    if days <= 180:
        return "6mo"
    if days <= 365:
        return "1y"
    if days <= 730:
        return "2y"
    return "5y"


def _live_financials(ticker: str) -> dict:
    yf = _yf()
    try:
        t = yf.Ticker(ticker)
        return {
            "income": _statements_from_df(t.quarterly_financials),
            "balance": _statements_from_df(t.quarterly_balance_sheet),
            "cashflow": _statements_from_df(t.quarterly_cashflow),
        }
    except Exception as exc:
        raise YFinanceError(f"yfinance financials({ticker}) failed: {exc}") from exc


def _statements_from_df(df) -> list[dict]:
    if df is None or getattr(df, "empty", True):
        return []
    out: list[dict] = []
    for col in df.columns:
        period = getattr(col, "date", lambda: col)()
        try:
            period_str = period.isoformat()
        except AttributeError:
            period_str = str(period)
        line_items: dict[str, Optional[float]] = {}
        for row_name, val in df[col].items():
            line_items[str(row_name)] = _opt_float(val)
        out.append(
            {
                "period_end": period_str,
                "period_type": "quarterly",
                "line_items": line_items,
            }
        )
    return out


def _live_news(ticker: str) -> list[dict]:
    yf = _yf()
    try:
        raw = yf.Ticker(ticker).news or []
    except Exception as exc:
        raise YFinanceError(f"yfinance news({ticker}) failed: {exc}") from exc

    rows: list[dict] = []
    for item in raw:
        content = item.get("content") or item
        published = content.get("pubDate") or item.get("providerPublishTime")
        rows.append(
            {
                "title": content.get("title") or item.get("title") or "(untitled)",
                "source": (content.get("provider") or {}).get("displayName")
                or item.get("publisher"),
                "url": (content.get("canonicalUrl") or {}).get("url")
                or item.get("link"),
                "published": published,
                "snippet": content.get("summary"),
            }
        )
    return rows


def _live_earnings(ticker: str) -> dict:
    yf = _yf()
    try:
        t = yf.Ticker(ticker)
        cal = getattr(t, "calendar", None)
        earnings_dates = getattr(t, "earnings_dates", None)
    except Exception as exc:
        raise YFinanceError(f"yfinance earnings({ticker}) failed: {exc}") from exc

    next_date = None
    if isinstance(cal, dict):
        dates = cal.get("Earnings Date") or []
        if dates:
            next_date = str(dates[0])

    last_date = None
    last_reported_eps = None
    last_estimated_eps = None
    last_surprise_pct = None
    if earnings_dates is not None and not getattr(earnings_dates, "empty", True):
        past = earnings_dates[earnings_dates.index < datetime.now(tz=timezone.utc)]
        if not past.empty:
            row = past.iloc[0]
            last_date = str(past.index[0].date())
            last_reported_eps = _opt_float(row.get("Reported EPS"))
            last_estimated_eps = _opt_float(row.get("EPS Estimate"))
            last_surprise_pct = _opt_float(row.get("Surprise(%)"))

    return {
        "next_earnings_date": next_date,
        "last_earnings_date": last_date,
        "last_reported_eps": last_reported_eps,
        "last_estimated_eps": last_estimated_eps,
        "last_surprise_pct": last_surprise_pct,
    }


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #


def _parse_statements(rows: list[dict]) -> list[FinancialStatement]:
    out: list[FinancialStatement] = []
    for row in rows:
        try:
            out.append(
                FinancialStatement(
                    period_end=_parse_date(row["period_end"]),
                    period_type=row.get("period_type", "quarterly"),
                    line_items={k: _opt_float(v) for k, v in row.get("line_items", {}).items()},
                )
            )
        except (KeyError, TypeError, ValueError):
            continue
    return out


def _parse_date(value) -> date:
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    return datetime.fromisoformat(str(value)).date()


def _parse_datetime(value) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(float(value), tz=timezone.utc)
    try:
        s = str(value).replace("Z", "+00:00")
        dt = datetime.fromisoformat(s)
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _opt_float(value) -> Optional[float]:
    if value is None:
        return None
    try:
        f = float(value)
    except (TypeError, ValueError):
        return None
    # pandas NaN check without importing pandas at module level
    if f != f:  # NaN
        return None
    return f


def _opt_int(value) -> Optional[int]:
    f = _opt_float(value)
    return int(f) if f is not None else None


def _opt_date(value) -> Optional[date]:
    if value is None:
        return None
    try:
        return _parse_date(value)
    except (ValueError, TypeError):
        return None
