# Investment Analyzer

A multi-agent AI application that produces balanced stock analysis using
six specialized Claude agents working in a four-stage pipeline.

> **Educational use only. Not financial advice. Do your own research.**

## How It Works

```
Data Collector (Agent 1)
        |
        v
+----------------+       +------------------+
| Technical (2)  | <-->  | Fundamental (3)  |   (parallel)
+----------------+       +------------------+
        |                         |
        +------------+------------+
                     v
          +---------+---------+
          |     Bull (4)      |
          |     Bear (5)      |   (parallel)
          +---------+---------+
                    |
                    v
               Judge (6)
                    |
                    v
          Detailed Report
```

1. **Data Collector** gathers raw facts from Yahoo Finance and SEC EDGAR.
2. **Technical Analyst** interprets computed indicators (SMA, EMA, RSI,
   MACD, Bollinger Bands, support/resistance).
3. **Fundamental Analyst** reviews financial statements, key ratios, and
   the latest 10-K / 10-Q / 8-K filings.
4. **Bull Analyst** builds the strongest possible buy case.
5. **Bear Analyst** builds the strongest possible sell/avoid case.
6. **Judge** weighs both theses against the technical and fundamental
   signals and issues a final recommendation.

## Project Status

Version 1.0 is under active development, following a phased plan:

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Functional requirements | done |
| 2 | Architecture design | done |
| 3 | Project scaffolding | done |
| 4 | Data layer | todo |
| 5 | Agent framework | todo |
| 6 | Agent implementation (6 agents) | todo |
| 7 | Orchestrator | todo |
| 8 | Report rendering | todo |
| 9 | Interactive CLI | todo |
| 10 | Polish & hardening | todo |

## Project Layout

```
investment_analyzer/
  __main__.py            # Entry point
  cli.py                 # Interactive CLI
  config.py              # Config loader
  orchestrator.py        # Four-stage pipeline coordinator
  logging_utils.py       # Structured JSONL logging
  models/                # Pydantic schemas
  data/                  # yfinance + SEC EDGAR + indicators
  agents/                # Six agents + prompt templates
  rendering/             # Console + Markdown renderers
tests/                   # pytest suite with offline fixtures
reports/                 # Generated Markdown reports (gitignored)
logs/                    # Per-run JSONL logs (gitignored)
```

## Setup

```bash
# Create and activate a virtualenv
python -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy the environment template and fill in your keys
cp .env.example .env
# edit .env and set ANTHROPIC_API_KEY and SEC_USER_AGENT
```

## Usage

Not yet wired up (Phase 9). When complete:

```bash
python -m investment_analyzer
# -> Enter ticker symbol: AAPL
# -> Analysis depth (quick / standard / deep): standard
# -> Save report to file? (y/n): y
```

## Configuration

- **`.env`** — secrets only (`ANTHROPIC_API_KEY`, `SEC_USER_AGENT`)
- **`config.yaml`** — model assignments per agent, depth presets,
  retry policy, indicator parameters, output directories

## Development

```bash
# Run the test suite (offline, uses cached fixtures)
pytest
```

Each development phase ends with a review gate and a git commit so
progress is visible and reversible.

## Disclaimer

This project is for educational and research purposes. Output should
not be construed as financial advice. Always do your own due diligence
before making investment decisions.
