"""End-to-end orchestrator tests.

Runs the full four-stage pipeline using mock agents to verify:
    * Correct ordering of sequential stages.
    * Parallel execution of Stage 2 and Stage 3.
    * Partial-failure tolerance.
Implemented in Phase 7.
"""
