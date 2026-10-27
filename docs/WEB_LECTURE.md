# Native Day 1 lecture

The default `/agents` view is now a single web lecture, with explanations and executable examples in the same topic. `#lesson/<id>` links open individual topics; old `#materials` and `#demos` links open the unified lecture. Day 2 routes and school API configuration remain unchanged.

- 19 topics preserve the original 120-minute schedule, including the break and references. All 14 examples remain available.
- Native React text, diagrams, code excerpts and tables replace slide images. Concept and execution share the desktop layout; narrow screens stack them. Long results and trace details are expandable/scrollable.
- Results retain the existing per-example, per-mode browser storage keys. The active topic is stored separately. No API request starts just by changing topics.
- Presentation mode requests native fullscreen and falls back to a viewport layout when unavailable. Escape exits; arrow keys change topics when the lecture container has focus.
- Recorded examples are explicitly marked as pre-generated rule-based output. Live MCP discovery and retrieval need no API key. Other live examples use the existing school API transport.
- Browser event logging snapshots mutable model inputs. Event searches expose IDs/titles, requiring a detail lookup; policy search returns cited Markdown sections, matching the teaching progression and original Python example.

`lib/day1-lessons.json` groups the original source material; `lib/web-lecture.ts` supplies native web copy, browser-specific corrections and the current BFCL Day 2 handoff. `scripts/build-web-lecture.py` can regenerate the source grouping from the parent `day1/materials/slides.json` when that teaching workspace is available. The production build does not require that parent directory or script.

Implementation: `app/web-lecture.tsx`, `app/web-lecture.css`. Original downloadable Python/PDF materials remain available as references; their older Day 2 slide describes the earlier mission, so use the web lecture for the current BFCL brief.

Validation: production build, TypeScript, fixture/lifecycle tests and browser checks. No new paid model inference or classroom concurrency test is implied by this frontend change.
