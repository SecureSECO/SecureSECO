# TrustSECO v2 local deployment

Open http://localhost:3001. The previous installation remains on port 3000.

From this directory: `sh local/start.sh` to build/start; `sh local/stop.sh` to stop
without deleting data. Docker Desktop must be running.

## Source snapshots

Sources exported from the documented TrustSECO2 deployment branches:

- Coordinator: SecureSECO, reverse-proxy-and-hosting, 520a1a529308af9287a066b682a2b0eedf2030c6
- Portal: SecureSECO-Portal, final-ui-improvements, 242d78cbddbb0694aaa461c9d3466ee7e34a4212
- Ledger: TrustSECO-DLT, hosting-ready, 8e7220303f6fbbba2f4ded9e52e77baf429282d3
- Spider: TrustSECO-Spider, final-spider-fixes, 2c98174ac4eacbb35df5c9485d917e993c4be6fc

These are branch snapshots, not verified live-server image digests.

## Local adaptations

- Local PRIVATE mode and frontend API hostname localhost:3001.
- UU seed peers removed; no P2P/RPC ports published.
- Separate Klayr ledger and GPG volumes; old data and credentials untouched.
- Portal built directly from source in local/web.Dockerfile.
- Docker management tools/socket omitted: SearchSECO miner management is unavailable.
- Scanner service omitted: virus-scan jobs are not supported by this local stack.
- Spider and automatic crawling start disabled. No credentials migrated or bundled.
- Web startup waits for a successful system_getNodeInfo RPC response.

## Verified

All three images built successfully. The portal rendered in the browser with the
new homepage. The API returned PRIVATE mode, an empty package list in the metrics,
and a live Klayr block height. No external peers were connected.
Account registration now passes for the local GPG identity (key ID
4773C9A174F70BA1), including when GitHub publishes multiple keys. The account
received the initial 50,000,000 slingers. Collection checks are described below.

Use only `compose.local.yaml` for this local stack; the upstream compose files
are retained for reference and include different deployment/network settings.

## GitHub registration fix (7 September 2026)

The coordinator and ledger are now local Git repositories on branch
`fix/github-key-registration`, based on the upstream commits listed above.
Credentials live in `.env` (mode 0600), ignored by Git and Docker build context.
Compose passes that file to the web service, which configures the Spider at startup.

The coordinator checks primary fingerprints instead of comparing whole ASCII key
bundles. Account registration carries the selected fingerprint to the ledger,
which parses all public-key armor blocks and stores only the selected key.
Legacy transactions without the optional fingerprint retain first-key selection.
A missing await in settingsStored is fixed; startup skips already registered accounts.

Both components must be deployed together for explicit fingerprint registration.
This is a local protocol change; no public network was upgraded. Registration
still fetches GitHub during ledger validation/execution, an existing architectural
limitation that this fix does not resolve.

Regression scripts: `local/tests/gpg-registration.cjs` runs in the ledger container
and uses generated public-key fixtures; `local/tests/gpg-fingerprints.cjs` runs in
the web container with the downloaded public GitHub key bundle. Both passed,
including an expired first key and selection of a later key. The account-command
Jest schema tests passed (2 tests, 1 snapshot; 4 upstream TODOs remain).
`local/tests/smoke-job.cjs` is a manual integration test that writes one package,
a signed GitHub language job, and its result to the local ledger.

End-to-end result: `requests` (psf, PyPI, 2.32.3) was registered; signed job 1
collected `gh_repository_language = "Python"` through the Spider and persisted
under account 4773C9A174F70BA1. The final balance was 49,999,000 slingers.
This verifies one GitHub fact, not every Spider source or the full scoring pipeline.

## Automatic collection

Local Compose now sets ENABLE_SPIDER=true. Startup loads the saved credentials
and starts the worker. The homepage shows Data collection with live activity;
setup instructions are in a separate Run your own node card. The stop API now
returns the success response expected by the toggle, and repeated starts reuse
one worker loop. Automatic discovery of unrelated packages remains disabled:
adding a package requests jobs, which the worker then collects.

## Live measurements and finality

Run `local/bootstrap.sh` to obtain component branches, copy `.env.example` to
`.env`, configure credentials, then run `local/start.sh`. This first local iteration
uses an atomic JSON measurement database in a named Docker volume. It is intended
for one coordinator process; do not share its file between multiple writers.

Measurements are stored immediately after collection, then signed, submitted,
observed in ledger state and finally confirmed. The HTTP measurements endpoint
merges local observations with ledger facts. WebSocket notifications update open
pages immediately; a five-second refresh handles finality changes and missed events.
The original trust-facts endpoint remains ledger-only.

The blue check requires that the canonical block at which the value was first
observed is at or below finalizedHeight. This conservative observation anchor is
not claimed to be the original transaction's inclusion block. Historical facts
lack original collection times and transaction IDs; those fields stay absent.
A reorg or ledger outage must not produce a new finality claim. Pending values
remain visible next to observations from earlier jobs. A finalized measurement is
not proof that the upstream data or collector is correct.

The package page's Confirmed only filter hides all unfinalized measurements.
Local and Confirmed scores use the ledger's same read-only scoring formula on
separate input subsets. The latest observation per fact type and submitting account
is selected independently within each subset; a pending update cannot remove an
older finalized input. Only numeric facts recognized by the formula contribute
to score coverage. Empty scoring subsets return null, not a baseline score.
Existing leaderboard scores retain the original calculation and are not finality-certified.

Validation: build the web image and run `node --test test/measurements.cjs` with
the test directory mounted into /usr/app/test. Six tests cover persistence, value
retention, inclusion versus finality, canonical-block changes, and old/new values.
The ledger additionally has `node test/gpg-registration.cjs` after `npm run build`.

Signed pending measurements survive coordinator restarts and are requeued at
startup. Job-creation requests still use the upstream in-memory queue; restarting
can lose unsubmitted job requests. The upstream one-transaction-per-block queue
has not been redesigned in this change.
