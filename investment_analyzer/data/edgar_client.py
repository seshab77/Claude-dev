"""SEC EDGAR client.

Uses the SEC's free JSON endpoints (no API key, but a descriptive
User-Agent header is required). Two public operations:

    * :func:`fetch_filings(ticker, forms, count)` — returns a list
      of :class:`Filing` objects for the requested form types.

    * :func:`ticker_to_cik(ticker)` — resolves a ticker to its
      10-digit zero-padded CIK.

All network calls are behind a ``fixture_path`` escape hatch so
tests run offline.

Respects SEC fair-use limits by enforcing a minimum inter-request
delay (10 requests/second hard cap per their docs, we use 5/s to
stay comfortably under).
"""

from __future__ import annotations

import json
import re
import time
from datetime import date, datetime
from pathlib import Path
from typing import Optional

from ..models.research import Filing


SEC_BASE = "https://data.sec.gov"
SEC_ARCHIVES = "https://www.sec.gov/Archives"
SEC_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json"

_MIN_REQUEST_INTERVAL_SECONDS = 0.2
_last_request_ts: float = 0.0


class EdgarError(RuntimeError):
    """Raised when an EDGAR call fails and there is no usable fixture."""


def _throttle() -> None:
    """Enforce the inter-request delay."""
    global _last_request_ts
    now = time.monotonic()
    wait = _MIN_REQUEST_INTERVAL_SECONDS - (now - _last_request_ts)
    if wait > 0:
        time.sleep(wait)
    _last_request_ts = time.monotonic()


def _headers(user_agent: str) -> dict[str, str]:
    if not user_agent or "@" not in user_agent:
        raise EdgarError(
            "SEC_USER_AGENT must be set and include a contact email "
            "(e.g., 'Your Name your@email.com'). See .env.example."
        )
    return {
        "User-Agent": user_agent,
        "Accept-Encoding": "gzip, deflate",
        "Host": "data.sec.gov",
    }


# --------------------------------------------------------------------------- #
# Fixture loading
# --------------------------------------------------------------------------- #


def _load_fixture(fixture_path: str | Path) -> dict:
    path = Path(fixture_path)
    if not path.exists():
        raise EdgarError(f"Fixture not found: {path}")
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


# --------------------------------------------------------------------------- #
# Public API
# --------------------------------------------------------------------------- #


def ticker_to_cik(
    ticker: str,
    user_agent: str | None = None,
    fixture_path: str | Path | None = None,
) -> Optional[str]:
    """Resolve a ticker to its zero-padded 10-digit CIK."""
    if fixture_path:
        data = _load_fixture(fixture_path)
        mapping = data.get("tickers", {})
        cik = mapping.get(ticker.upper())
        return f"{int(cik):010d}" if cik else None

    assert user_agent is not None, "user_agent required for live calls"
    import requests  # deferred

    _throttle()
    try:
        resp = requests.get(
            SEC_TICKERS_URL,
            headers={"User-Agent": user_agent},
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        raise EdgarError(f"Failed to fetch SEC ticker list: {exc}") from exc

    upper = ticker.upper()
    for row in data.values():
        if row.get("ticker", "").upper() == upper:
            return f"{int(row['cik_str']):010d}"
    return None


def fetch_filings(
    ticker: str,
    forms: list[str] | None = None,
    count: int = 4,
    user_agent: str | None = None,
    fixture_path: str | Path | None = None,
    extract_text: bool = True,
) -> list[Filing]:
    """Return the most recent ``count`` filings matching ``forms``.

    When ``fixture_path`` is supplied, a ``filings`` list is expected
    in the fixture with the same shape as :class:`Filing`.
    """
    forms = forms or ["10-K", "10-Q", "8-K"]

    if fixture_path:
        data = _load_fixture(fixture_path)
        raw = data.get("filings", [])
        out: list[Filing] = []
        for row in raw:
            if row.get("form_type") not in forms:
                continue
            out.append(
                Filing(
                    form_type=row["form_type"],
                    filed_date=_parse_date(row["filed_date"]),
                    period_of_report=_opt_date(row.get("period_of_report")),
                    accession_number=row.get("accession_number"),
                    url=row.get("url"),
                    extracted_text=row.get("extracted_text"),
                )
            )
        out.sort(key=lambda f: f.filed_date, reverse=True)
        return out[:count]

    assert user_agent is not None, "user_agent required for live calls"

    cik = ticker_to_cik(ticker, user_agent=user_agent)
    if cik is None:
        raise EdgarError(f"Ticker {ticker} not found in SEC ticker list")

    submissions = _fetch_submissions(cik, user_agent)
    filings = _select_recent_filings(submissions, forms, count)

    out = []
    for f in filings:
        doc_url = _build_filing_url(cik, f["accession_number"], f["primary_document"])
        text = None
        if extract_text:
            try:
                text = _fetch_and_extract(doc_url, user_agent, form_type=f["form_type"])
            except EdgarError:
                text = None
        out.append(
            Filing(
                form_type=f["form_type"],
                filed_date=_parse_date(f["filed_date"]),
                period_of_report=_opt_date(f.get("period_of_report")),
                accession_number=f["accession_number"],
                url=doc_url,
                extracted_text=text,
            )
        )
    return out


# --------------------------------------------------------------------------- #
# Internal helpers
# --------------------------------------------------------------------------- #


def _fetch_submissions(cik: str, user_agent: str) -> dict:
    import requests

    _throttle()
    url = f"{SEC_BASE}/submissions/CIK{cik}.json"
    try:
        resp = requests.get(url, headers=_headers(user_agent), timeout=15)
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:
        raise EdgarError(f"Failed to fetch submissions for CIK {cik}: {exc}") from exc


def _select_recent_filings(
    submissions: dict, forms: list[str], count: int
) -> list[dict]:
    recent = submissions.get("filings", {}).get("recent", {})
    if not recent:
        return []

    rows = list(
        zip(
            recent.get("form", []),
            recent.get("filingDate", []),
            recent.get("reportDate", []),
            recent.get("accessionNumber", []),
            recent.get("primaryDocument", []),
        )
    )

    selected: list[dict] = []
    for form_type, filed_date, report_date, accession, primary_document in rows:
        if form_type not in forms:
            continue
        selected.append(
            {
                "form_type": form_type,
                "filed_date": filed_date,
                "period_of_report": report_date,
                "accession_number": accession,
                "primary_document": primary_document,
            }
        )
        if len(selected) >= count:
            break
    return selected


def _build_filing_url(cik: str, accession_number: str, primary_document: str) -> str:
    acc_no_dashes = accession_number.replace("-", "")
    return f"{SEC_ARCHIVES}/edgar/data/{int(cik)}/{acc_no_dashes}/{primary_document}"


def _fetch_and_extract(url: str, user_agent: str, form_type: str) -> str:
    """Download an HTML filing and extract the most useful section."""
    import requests

    _throttle()
    try:
        resp = requests.get(
            url,
            headers={"User-Agent": user_agent},
            timeout=30,
        )
        resp.raise_for_status()
        html = resp.text
    except Exception as exc:
        raise EdgarError(f"Failed to fetch filing {url}: {exc}") from exc

    return extract_filing_text(html, form_type=form_type)


def extract_filing_text(html: str, form_type: str, max_chars: int = 20_000) -> str:
    """Strip HTML and extract the most relevant section for the form.

    * 10-K / 10-Q: try to isolate the Management's Discussion & Analysis
      (MD&A) section.
    * 8-K: return the lead body (often an earnings press release).

    Falls back to the first ``max_chars`` characters of plain text when
    section markers are not found.
    """
    try:
        from bs4 import BeautifulSoup  # type: ignore

        soup = BeautifulSoup(html, "html.parser")
        for tag in soup(["script", "style"]):
            tag.decompose()
        text = soup.get_text(separator="\n")
    except ImportError:
        # Fallback: naive HTML strip.
        text = re.sub(r"<[^>]+>", " ", html)

    text = re.sub(r"\n\s*\n", "\n\n", text)
    text = re.sub(r"[ \t]+", " ", text).strip()

    if form_type in ("10-K", "10-Q"):
        extracted = _extract_mdna(text)
        if extracted:
            return extracted[:max_chars]

    return text[:max_chars]


_MDNA_START_RE = re.compile(
    r"(item\s*7\.?\s*management['\u2019]s\s+discussion\s+and\s+analysis"
    r"|item\s*2\.?\s*management['\u2019]s\s+discussion\s+and\s+analysis)",
    re.IGNORECASE,
)
_MDNA_END_RE = re.compile(
    r"(item\s*7a\.?\s*quantitative"
    r"|item\s*8\.?\s*financial\s+statements"
    r"|item\s*3\.?\s*quantitative)",
    re.IGNORECASE,
)


def _extract_mdna(text: str) -> Optional[str]:
    start_match = _MDNA_START_RE.search(text)
    if not start_match:
        return None
    # Start the MD&A content at the end of the heading match so the
    # heading itself isn't re-matched by the end-marker regex.
    content_start = start_match.end()
    tail = text[content_start:]
    end_match = _MDNA_END_RE.search(tail)
    body = tail[: end_match.start()] if end_match else tail
    # Return the heading + body so the caller still sees the section
    # title for context.
    return text[start_match.start() : content_start] + body


def _parse_date(value) -> date:
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    return datetime.fromisoformat(str(value)).date()


def _opt_date(value) -> Optional[date]:
    if not value:
        return None
    try:
        return _parse_date(value)
    except ValueError:
        return None
