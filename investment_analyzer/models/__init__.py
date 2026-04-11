"""Pydantic data schemas shared across agents and renderers."""

from .research import (
    CompanyProfile,
    EarningsInfo,
    Filing,
    Financials,
    FinancialStatement,
    KeyMetrics,
    NewsItem,
    PricePoint,
    PriceSeries,
    ResearchPacket,
)
from .analysis import (
    AnalystInput,
    FilingHighlight,
    FundamentalView,
    IndicatorSignal,
    TechnicalView,
    Thesis,
    ThesisPoint,
    Stance,
    Trend,
    Verdict as AnalysisVerdict,
)
from .report import FinalRecommendation, Report, Verdict

__all__ = [
    # research
    "CompanyProfile",
    "EarningsInfo",
    "Filing",
    "Financials",
    "FinancialStatement",
    "KeyMetrics",
    "NewsItem",
    "PricePoint",
    "PriceSeries",
    "ResearchPacket",
    # analysis
    "AnalystInput",
    "FilingHighlight",
    "FundamentalView",
    "IndicatorSignal",
    "TechnicalView",
    "Thesis",
    "ThesisPoint",
    "Stance",
    "Trend",
    "AnalysisVerdict",
    # report
    "FinalRecommendation",
    "Report",
    "Verdict",
]
