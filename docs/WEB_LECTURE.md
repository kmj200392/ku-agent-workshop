# Native Day 1 lecture

The default `/agents` view is the five-page course introduction: cover, instructor, course goals, two-day flow and preparation. The first sidebar tab opens this deck; `#intro/<id>` links address its pages, with a separate browser resume key. It uses the same lecture navigation and fullscreen styling. Its final page links to API settings and `#lesson/start`. Day 1 remains a single web lecture, with explanations and executable examples in the same topic. `#lesson/<id>` links open individual topics; old `#materials` and `#demos` links open the unified lecture. Day 2 routes remain unchanged. Both the lecture and evaluation use the provider selected in the API settings.

- 18 topics include the references, with the standalone break page removed. All 14 examples remain available.
- Native React text, diagrams, code excerpts and tables replace slide images. Concept and execution share the desktop layout; narrow screens stack them. Long results and trace details are expandable/scrollable.
- Results retain the existing per-example, per-mode browser storage keys. The active topic is stored separately. No API request starts just by changing topics.
- Fullscreen uses a viewport-height layout with fixed navigation and adaptive content spacing. Long results, traces and expanded references scroll inside their own panels. Native fullscreen falls back to the same layout when unavailable; the underlying page is locked until exit. Escape exits; arrow keys change topics when the lecture container has focus.
- Recorded examples are explicitly marked as pre-generated rule-based output. Live MCP discovery and retrieval need no API key. Other live examples call either the school API or OpenAI API, as selected by the participant. Completed live records include the provider and model.
- Browser event logging snapshots mutable model inputs. Event searches expose IDs/titles, requiring a detail lookup; policy search returns cited Markdown sections, matching the teaching progression and original Python example.

`lib/day1-lessons.json` groups the original source material; `lib/web-lecture.ts` supplies native web copy, browser-specific corrections and the current BFCL Day 2 handoff. `scripts/build-web-lecture.py` can regenerate the source grouping from the parent `day1/materials/slides.json` when that teaching workspace is available. The production build does not require that parent directory or script.

Implementation: `app/web-lecture.tsx`, `app/web-lecture.css`. Original downloadable Python/PDF materials remain available as references; their older Day 2 slide describes the earlier mission, so use the web lecture for the current BFCL brief.

Validation: production build, TypeScript, fixture/lifecycle tests and browser checks. No new paid model inference or classroom concurrency test is implied by this frontend change.
