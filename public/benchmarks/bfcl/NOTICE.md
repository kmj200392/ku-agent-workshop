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
- v2: 12 practice cases from 8 families; 30 final cases from 17 disjoint families.
- Retains 26 BFCL-derived tasks (14 final variants have clarified wording), adds 6 authored practice tasks and 10 authored final tasks. Per-case provenance records all edits. Authored tasks are not official BFCL questions.
- Excludes families 153, 159, 164, 179 after reviewing ambiguous or contradictory user requirements.
- Retained BFCL cases keep their original initial state and reference actions. Tool semantics are unchanged. Prompts remain in English, with the wording changes recorded in provenance; Korean titles/UI are added.
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
The final set contains variants of 17 stories, not 30 statistically independent scenarios. The original 20 tasks were inspected during instructor development; this is a teaching benchmark, not an independently blinded evaluation.

To reproduce v2 from the preserved v1 Git snapshot: python3 scripts/bfcl/expand-v2.py. Reference actions and source checksums are verified before model evaluation.
Source selection and original IDs are retained with the project. Final data is delivered after code freeze.
