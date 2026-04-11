"""Investment Analyzer — multi-agent AI investment analysis package.

A six-agent pipeline that produces a balanced Buy/Hold/Sell recommendation:

    Data Collector -> Technical Analyst + Fundamental Analyst (parallel)
                   -> Bull Analyst + Bear Analyst (parallel)
                   -> Judge (final synthesis)

Educational use only. Not financial advice.
"""

__version__ = "1.0.0"
