"""Analysis-phase data models.

Contains the structured outputs of the Technical, Fundamental, Bull,
and Bear agents. These flow into the Judge which produces the final
report.
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


Trend = Literal["bullish", "bearish", "neutral"]
Verdict = Literal["strong", "mixed", "weak"]
Stance = Literal["bull", "bear"]


class IndicatorSignal(BaseModel):
    """A single technical indicator reading with interpretation."""

    name: str            # e.g. "RSI(14)", "MACD", "SMA(50)"
    value: float
    interpretation: str  # e.g. "overbought", "bullish crossover"
    bias: Trend


class TechnicalView(BaseModel):
    """Output of the Technical Analyst agent."""

    ticker: str
    trend: Trend
    signals: list[IndicatorSignal] = Field(default_factory=list)
    support_levels: list[float] = Field(default_factory=list)
    resistance_levels: list[float] = Field(default_factory=list)
    summary: str
    confidence: float = Field(ge=0.0, le=1.0)


class FilingHighlight(BaseModel):
    """A notable excerpt pulled from an SEC filing by the analyst."""

    form_type: str
    theme: str           # e.g. "guidance", "risk", "restructuring"
    excerpt: str
    sentiment: Literal["positive", "negative", "neutral"]


class FundamentalView(BaseModel):
    """Output of the Fundamental Analyst agent."""

    ticker: str
    earnings_trend: str
    ratio_analysis: dict[str, str] = Field(default_factory=dict)
    filing_highlights: list[FilingHighlight] = Field(default_factory=list)
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    verdict: Verdict
    summary: str
    confidence: float = Field(ge=0.0, le=1.0)


class ThesisPoint(BaseModel):
    """A single claim with a citation back to source data."""

    claim: str
    citation: str        # e.g. "RSI=72 (overbought)" or "Q4 revenue +18% YoY"


class Thesis(BaseModel):
    """Output of the Bull or Bear agent."""

    stance: Stance
    key_points: list[ThesisPoint] = Field(default_factory=list)
    supporting_metrics: dict[str, str] = Field(default_factory=dict)
    time_horizon: str    # e.g. "6-12 months"
    summary: str
    confidence: float = Field(ge=0.0, le=1.0)


class AnalystInput(BaseModel):
    """Input to the Bull and Bear agents.

    Bundles the research packet with the earlier technical and
    fundamental views so each analyst can cite any piece of evidence.
    """

    # ResearchPacket is in a sibling module; use string-deferred
    # reference to keep import graph flat.
    model_config = {"arbitrary_types_allowed": True}

    packet: object
    technical: Optional[TechnicalView] = None
    fundamental: Optional[FundamentalView] = None
