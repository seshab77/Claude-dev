"""SEC EDGAR client.

Fetches the latest 10-K, 10-Q, and 8-K filings for a given ticker
(via CIK lookup) and extracts relevant sections such as MD&A and
earnings press releases. Respects SEC rate limits and sets a
conforming User-Agent header.

Implemented in Phase 4.
"""

from __future__ import annotations
