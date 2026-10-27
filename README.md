# KU Agent Lab — Vercel edition

Independent deployment for https://lectures.minjaek.im.

See [deployment instructions](docs/DEPLOYMENT.md).

```sh
npm ci
# .env.local: TURSO_DATABASE_URL=file:./workshop.db
npm run db:migrate
npm run dev
```

Next.js serves the UI and small storage API. Python execution, BFCL tools and grading run entirely in each student browser. Real inference calls the Korea University gateway directly. The server stores participants, source versions and compact score summaries only.

The original lecture assets and BFCL provenance are included. See [benchmark verification](docs/BFCL_VERIFICATION.md); that document records the earlier Sites validation, not verification of this deployment.

```sh
npm test
npm run typecheck
python3 -B -m unittest discover -s tests -p '*_test.py' -v
npm run build
```

## Lecture catalog

- `/`: lecture catalog at https://lectures.minjaek.im
- `/agents`: current AI Agent workshop (demos, workspace and leaderboard)

To add a lecture, create its `app/<slug>/page.tsx` route and add its information to `lib/lectures.ts`. The home page renders the catalog automatically. Give new interactive courses their own storage keys and API/data namespace rather than reusing the agents leaderboard. Current workshop assets and API routes keep their root-relative URLs.

## In-browser lecture materials

`/agents#materials` displays the original Day 1 deck with a table of contents, keyboard navigation, fullscreen, text alternatives and page resume. PDF and ZIP downloads remain available. Static WebP slides avoid PDF plugin requirements and on-demand image transforms.

After replacing `public/day1-materials.zip`, regenerate assets with `python3 scripts/build-lecture-materials.py` (Poppler and Pillow required locally). The script verifies page counts, preserves the original PDF bytes and excludes instructor notes from the text manifest. Page resume is versioned by the PDF hash.
