"""Final report data models.

:class:`FinalRecommendation` is produced by the Judge agent.
:class:`Report` bundles every stage output for rendering.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

from .analysis import FundamentalView, TechnicalView, Thesis
from .research import ResearchPacket


Verdict = Literal["Strong Buy", "Buy", "Hold", "Sell", "Strong Sell"]


class FinalRecommendation(BaseModel):
    """Output of the Judge agent."""

    ticker: str
    verdict: Verdict
    confidence: float = Field(ge=0.0, le=1.0)
    rationale: str
    weighted_bull_points: list[str] = Field(default_factory=list)
    weighted_bear_points: list[str] = Field(default_factory=list)
    key_risks_to_monitor: list[str] = Field(default_factory=list)
    time_horizon: str


class Report(BaseModel):
    """Full run result — passed to the renderers."""

    ticker: str
    generated_at: datetime
    depth: str

    packet: ResearchPacket
    technical: Optional[TechnicalView] = None
    fundamental: Optional[FundamentalView] = None
    bull: Optional[Thesis] = None
    bear: Optional[Thesis] = None
    final: Optional[FinalRecommendation] = None

    errors: list[str] = Field(default_factory=list)
