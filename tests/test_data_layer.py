"""Tests for the data layer (yfinance wrapper and EDGAR client).

Uses offline fixtures in ``investment_analyzer/data/fixtures/`` so the
suite runs without network access or yfinance installed.
"""

from __future__ import annotations

from datetime import date
from pathlib import Path

import pytest

from investment_analyzer.data import edgar_client, yfinance_client
from investment_analyzer.data.edgar_client import EdgarError, extract_filing_text
from investment_analyzer.data.yfinance_client import YFinanceError


FIXTURE_DIR = Path(__file__).parents[1] / "investment_analyzer" / "data" / "fixtures"
YF_FIXTURE = FIXTURE_DIR / "AAPL_yf.json"
EDGAR_FIXTURE = FIXTURE_DIR / "AAPL_edgar.json"


# --------------------------------------------------------------------------- #
# yfinance wrapper
# --------------------------------------------------------------------------- #


def test_fetch_profile_from_fixture():
    profile = yfinance_client.fetch_profile("AAPL", fixture_path=YF_FIXTURE)
    assert profile.ticker == "AAPL"
    assert profile.name == "Apple Inc."
    assert profile.sector == "Technology"
    assert profile.market_cap == 3_200_000_000_000
    assert profile.employees == 164_000


def test_fetch_price_history_from_fixture():
    series = yfinance_client.fetch_price_history(
        "AAPL", lookback_days=365, fixture_path=YF_FIXTURE
    )
    assert series.ticker == "AAPL"
    assert len(series.points) == 5
    assert series.points[-1].close == pytest.approx(231.80)
    assert series.latest_close() == pytest.approx(231.80)
    # Dates parse correctly.
    assert series.points[0].date == date(2026, 4, 7)


def test_fetch_key_metrics_from_fixture():
    m = yfinance_client.fetch_key_metrics("AAPL", fixture_path=YF_FIXTURE)
    assert m.pe_ratio == pytest.approx(32.5)
    assert m.forward_pe == pytest.approx(28.9)
    assert m.gross_margin == pytest.approx(0.462)
    assert m.return_on_equity == pytest.approx(1.52)


def test_fetch_financials_from_fixture():
    f = yfinance_client.fetch_financials("AAPL", fixture_path=YF_FIXTURE)
    assert len(f.income_statements) == 2
    assert f.income_statements[0].period_end == date(2025, 12, 31)
    assert f.income_statements[0].line_items["Total Revenue"] == 124_000_000_000
    assert len(f.balance_sheets) == 1
    assert len(f.cash_flow_statements) == 1


def test_fetch_news_populates_items():
    recent = yfinance_client.fetch_news(
        "AAPL", days=365, fixture_path=YF_FIXTURE
    )
    assert len(recent) >= 1  # within 1 year
    # Fields parsed into the Pydantic model.
    assert all(n.title for n in recent)
    assert any("earnings" in n.title.lower() for n in recent)
    assert any(n.published is not None for n in recent)


def test_fetch_earnings_from_fixture():
    e = yfinance_client.fetch_earnings("AAPL", fixture_path=YF_FIXTURE)
    assert e.next_earnings_date == date(2026, 7, 30)
    assert e.last_earnings_date == date(2026, 1, 30)
    assert e.last_reported_eps == pytest.approx(2.40)
    assert e.last_surprise_pct == pytest.approx(3.0)


def test_missing_fixture_raises():
    with pytest.raises(YFinanceError):
        yfinance_client.fetch_profile("AAPL", fixture_path="/does/not/exist.json")


# --------------------------------------------------------------------------- #
# SEC EDGAR client
# --------------------------------------------------------------------------- #


def test_ticker_to_cik_from_fixture():
    cik = edgar_client.ticker_to_cik("AAPL", fixture_path=EDGAR_FIXTURE)
    assert cik == "0000320193"
    # Case-insensitive.
    assert edgar_client.ticker_to_cik("aapl", fixture_path=EDGAR_FIXTURE) == "0000320193"
    # Unknown ticker returns None.
    assert edgar_client.ticker_to_cik("ZZZZ", fixture_path=EDGAR_FIXTURE) is None


def test_fetch_filings_from_fixture_sorted_and_limited():
    filings = edgar_client.fetch_filings(
        "AAPL", count=2, fixture_path=EDGAR_FIXTURE
    )
    assert len(filings) == 2
    # Sorted newest-first.
    assert filings[0].filed_date >= filings[1].filed_date
    # Most recent filing in the fixture.
    assert filings[0].form_type == "10-Q"
    assert filings[0].period_of_report == date(2025, 12, 28)


def test_fetch_filings_filters_by_form():
    eightk = edgar_client.fetch_filings(
        "AAPL", forms=["8-K"], count=5, fixture_path=EDGAR_FIXTURE
    )
    assert len(eightk) == 2
    assert all(f.form_type == "8-K" for f in eightk)


def test_missing_edgar_fixture_raises():
    with pytest.raises(EdgarError):
        edgar_client.fetch_filings("AAPL", fixture_path="/does/not/exist.json")


# --------------------------------------------------------------------------- #
# Filing text extraction
# --------------------------------------------------------------------------- #


def test_extract_filing_text_finds_mdna_in_10k():
    html = """
    <html><body>
      <h1>Annual Report</h1>
      <p>Item 1. Business</p>
      <p>We make phones.</p>
      <p>Item 7. Management's Discussion and Analysis of Financial Condition and Results of Operations</p>
      <p>Revenue grew 4.5% year-over-year driven by strong iPhone demand.</p>
      <p>Services margins expanded to 74%.</p>
      <p>Item 7A. Quantitative and Qualitative Disclosures About Market Risk</p>
      <p>Interest rate risk is limited.</p>
    </body></html>
    """
    text = extract_filing_text(html, form_type="10-K")
    assert "Management's Discussion" in text
    assert "Revenue grew 4.5%" in text
    assert "Interest rate risk" not in text  # excluded by end marker


def test_extract_filing_text_falls_back_to_body_for_8k():
    html = """
    <html><body>
      <p>Apple announced Q1 results with revenue of $124B.</p>
    </body></html>
    """
    text = extract_filing_text(html, form_type="8-K")
    assert "revenue of $124B" in text


def test_extract_filing_text_handles_plain_text_fallback():
    # No MD&A markers -> returns first max_chars of text.
    text = extract_filing_text(
        "<p>" + ("A" * 100) + "</p>", form_type="10-K", max_chars=50
    )
    assert len(text) <= 50
