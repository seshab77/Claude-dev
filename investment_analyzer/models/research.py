"""Research-phase data models.

Contains the :class:`ResearchPacket` produced by the Data Collector
agent plus its nested components. These models are populated from
the data layer (yfinance + SEC EDGAR) and passed unchanged through
the rest of the pipeline as the canonical factual input.
"""

from __future__ import annotations

from datetime import datetime, date
from typing import Optional

from pydantic import BaseModel, Field


class CompanyProfile(BaseModel):
    """High-level company information."""

    ticker: str
    name: str
    sector: Optional[str] = None
    industry: Optional[str] = None
    country: Optional[str] = None
    market_cap: Optional[float] = None
    employees: Optional[int] = None
    website: Optional[str] = None
    description: Optional[str] = None


class PricePoint(BaseModel):
    """A single OHLCV bar."""

    date: date
    open: float
    high: float
    low: float
    close: float
    volume: int


class PriceSeries(BaseModel):
    """A contiguous time series of OHLCV bars."""

    ticker: str
    period_days: int
    points: list[PricePoint] = Field(default_factory=list)

    def latest_close(self) -> Optional[float]:
        return self.points[-1].close if self.points else None


class FinancialStatement(BaseModel):
    """One reporting period's statement line items.

    Stored as a free-form dict so the schema works for both quarterly
    and annual statements regardless of which line items the source
    provides. Downstream agents interpret the content.
    """

    period_end: date
    period_type: str  # "quarterly" or "annual"
    line_items: dict[str, Optional[float]] = Field(default_factory=dict)


class Financials(BaseModel):
    """Income, balance, and cash-flow statements for a ticker."""

    income_statements: list[FinancialStatement] = Field(default_factory=list)
    balance_sheets: list[FinancialStatement] = Field(default_factory=list)
    cash_flow_statements: list[FinancialStatement] = Field(default_factory=list)


class KeyMetrics(BaseModel):
    """Selected ratios and per-share metrics."""

    pe_ratio: Optional[float] = None
    forward_pe: Optional[float] = None
    pb_ratio: Optional[float] = None
    peg_ratio: Optional[float] = None
    eps_ttm: Optional[float] = None
    revenue_growth_yoy: Optional[float] = None
    earnings_growth_yoy: Optional[float] = None
    gross_margin: Optional[float] = None
    operating_margin: Optional[float] = None
    net_margin: Optional[float] = None
    return_on_equity: Optional[float] = None
    debt_to_equity: Optional[float] = None
    current_ratio: Optional[float] = None
    dividend_yield: Optional[float] = None
    beta: Optional[float] = None


class NewsItem(BaseModel):
    """A single news article reference."""

    title: str
    source: Optional[str] = None
    url: Optional[str] = None
    published: Optional[datetime] = None
    snippet: Optional[str] = None


class Filing(BaseModel):
    """An SEC EDGAR filing reference."""

    form_type: str  # e.g., "10-K", "10-Q", "8-K"
    filed_date: date
    period_of_report: Optional[date] = None
    accession_number: Optional[str] = None
    url: Optional[str] = None
    extracted_text: Optional[str] = None  # truncated MD&A / press release


class EarningsInfo(BaseModel):
    """Upcoming and historical earnings dates plus EPS data."""

    next_earnings_date: Optional[date] = None
    last_earnings_date: Optional[date] = None
    last_reported_eps: Optional[float] = None
    last_estimated_eps: Optional[float] = None
    last_surprise_pct: Optional[float] = None


class ResearchPacket(BaseModel):
    """Everything the Data Collector produces — passed unchanged to
    all downstream agents. Agents read this; they never mutate it.
    """

    ticker: str
    as_of: datetime
    profile: CompanyProfile
    price_history: PriceSeries
    financials: Financials = Field(default_factory=Financials)
    key_metrics: KeyMetrics = Field(default_factory=KeyMetrics)
    news: list[NewsItem] = Field(default_factory=list)
    filings: list[Filing] = Field(default_factory=list)
    earnings: EarningsInfo = Field(default_factory=EarningsInfo)
    data_gaps: list[str] = Field(default_factory=list)
