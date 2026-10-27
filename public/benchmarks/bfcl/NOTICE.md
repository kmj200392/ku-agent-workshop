# BFCL Travel workshop subset

Upstream: Berkeley Function Calling Leaderboard, ShishirPatil/gorilla
https://github.com/ShishirPatil/gorilla
Pinned commit: 6ea57973c7a6097fd7c5915698c54c17c5b1b6c8
License: Apache License 2.0 (see LICENSE alongside this file).

This educational derivative uses BFCL V4 Multi-turn TravelAPI tasks, function documentation,
Python simulation environment and evaluation checks. The original Python files under
bfcl_eval/ are unmodified; hashes and dataset source hashes are in manifest.json.
Copyright and license notices remain in the redistributed source and LICENSE.

Workshop additions/changes:
- 6 practice cases from 2 original story families; 20 final cases from 7 other families.
- Excludes families153,159,164,179 after reviewing ambiguous or contradictory user requirements.
- Original English prompts, initial state, tool semantics and answers retained. Korean titles/UI added.
- The upstream missing-function restoration message is preserved.
- JSON Schema types are normalized for the OpenAI-compatible Gateway; response documentation is
  appended to tool descriptions. Browser transport is implemented in workshop_bridge.py.
- Per-turn and per-case call/time limits differ from the official complete benchmark.
- A submitted Python function may retain its own conversation memory between user turns.
- Original state/response and irrelevance checkers determine success; all turns must pass.
- Missing-information/function turns with empty ground truth require NO tool calls.
- Natural-language answer quality is not graded. This subset is not a complete RAG, MCP or long-term-memory test.

This is a BFCL-based classroom leaderboard, not an official BFCL leaderboard submission or overall score.
Student browsers execute tools and grade results; uploaded scores are client-reported, not tamper-proof.
The final set contains variants of7 stories, not20 statistically independent scenarios.

To reproduce the selected data from the pinned source: python3 scripts/bfcl/import.py
Source selection and original IDs are retained with the project. Final data is delivered after code freeze.
