# MarkSnip Tests

All test commands run from `src/`.

## Commands

- `npm test` runs the Jest suite.
- `npm run test:coverage -- --runInBand` collects coverage for runtime shells and shared helpers.
- `npm run test:e2e -- tests/e2e/extension.spec.js` runs deterministic extension smoke coverage.
- `npm run test:e2e -- tests/e2e/notifications.spec.js` runs notification behavior E2E.
- `npm run test:e2e -- tests/e2e/batch-processing.spec.js` runs fixture-backed batch processing E2E.

## Architecture

The suite is split into three layers:

- Unit tests import shared production helpers directly from `src/shared/`.
- Integration tests exercise real Turndown and Readability behavior through `tests/helpers/browser-env.js`.
- E2E tests run the real extension in Chromium against deterministic local fixtures under `tests/fixtures/e2e-pages/`.

The main rule is: do not add mirrored copies of production logic to tests. If a behavior needs unit coverage, extract an importable helper first and test that helper directly.

## Shared Helper Coverage

Coverage recovery in this repo is helper-first:

- Large entrypoint shells like `offscreen.js`, `popup.js`, `options.js`, and `service-worker.js` are still exercised mostly through integration and E2E paths.
- New logic should prefer importable shared helpers with direct unit coverage.
- Per-file coverage thresholds should only be added for extracted shared helpers, not as a global repo threshold.

## Fixture-Backed E2E

CI-gated E2E must not depend on public internet availability.

- `tests/e2e/extension.spec.js` uses routed fixture pages.
- `tests/e2e/notifications.spec.js` uses a routed local notification host page.
- `tests/e2e/batch-processing.spec.js` serves deterministic local HTML fixtures and inspects the real extension batch harness.

When adding or updating E2E coverage, prefer local fixture HTML or explicit route fulfillment over live websites.

## Live Public Coverage

`npm run test:e2e` now includes `tests/e2e/live-public.spec.js` by default. That spec clips real public pages through the popup flow, covering:

- `https://example.com/`
- `https://en.wikipedia.org/wiki/Markdown`
- `https://help.obsidian.md/links`
- `https://sebastian.graphics/blog/16-bit-tiny-model-standalone-c-with-open-watcom.html`
- `https://www.visualmode.dev/ruby-operators/array-argument`
- `https://ruby-doc.org/3.3.6/Data.html`
- `https://runjs.app/blog/equations-that-changed-the-world-rewritten-in-javascript`

If you only want a single live spec, you can still run it directly:

- `npm run test:e2e -- tests/e2e/live-public.spec.js`

Each live case also writes local triage artifacts to `src/test-artifacts/live-public/<case-id>/`:

- `latest-success/` stores the most recent passing HTML snapshot, clipped markdown, and summary.
- `history/<timestamp>-passed|failed/` stores every captured run without overwriting the last successful baseline.
- Failed runs include `comparison-to-latest.json` so you can tell whether the page changed since the previous successful run.

## Adding Tests

- For pure logic, add or extend a shared helper in `src/shared/` and test it from `tests/unit/`.
- For conversion behavior, extend the integration suite so the production Turndown/Readability configuration stays locked.
- For browser workflows, add deterministic fixtures first, then assert extension behavior against those fixtures.
