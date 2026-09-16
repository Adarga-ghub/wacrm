# Time-based automations and the cron sweep

Tag- and message-triggered automation steps (add a tag, send a
message, assign a conversation, …) run **synchronously**, inline with
the inbound WhatsApp webhook. They need nothing extra to work.

Anything that depends on _time passing_ — a `Wait` step in an
automation, or a flow's abandon-timeout — does not run inline, because
nothing is blocked waiting for it. It is instead parked in the
database and only resumes when something polls for due work. That
poll is what this doc covers.

The one exception is a `Wait` step in **`seconds`** — see
[Seconds is the exception](#seconds-is-the-exception) below.

## What gets parked, and where

- **Automation `Wait` steps (`minutes` / `hours` / `days`).** When an
  automation's step list hits a `wait` step in one of these units,
  `runAutomationsForTrigger` (see `src/lib/automations/engine.ts`)
  inserts a row into `automation_pending_executions` with `run_at` set
  to `now() + <wait duration>` and `status = 'pending'`, then stops. The
  automation's remaining steps (e.g. the recovery message) are _not_
  executed yet — they are `next_step_position` on that row, waiting.
- **Flow timeouts.** A `flow_runs` row stays `status = 'active'` until
  either the contact replies (normal advance) or it is swept as
  `timed_out` after `fallback_policy.on_timeout_hours` (24h by
  default). Nothing marks it `timed_out` on its own.

## Seconds is the exception

A `Wait` step in **`seconds`** never touches
`automation_pending_executions` and never waits on either cron
endpoint. `executeStepsFrom` (`src/lib/automations/engine.ts`) instead
`await`s an in-process `setTimeout` right where it is — a few seconds
of the live run parked in memory, not the database — then falls
through to the next step in the same call. This exists so a chain of
`send_message` steps can be spaced out (avoid landing on the customer
as a burst) without waiting up to a full 5-minute cron tick for a
1-second pause, and without changing the cron's own interval.

Because the delay blocks whatever request is running the automation
(the webhook handler, the manual `/api/automations/engine` trigger,
tag-add dispatch, …), it is capped at `MAX_INLINE_WAIT_SECONDS` (120s,
`src/lib/automations/validate.ts`) — both at activation-time validation
and again as a defense-in-depth clamp in the engine itself. A pause
longer than that belongs in the `minutes` unit, which parks the run
instead of holding a connection open.

## The two cron endpoints

| Endpoint                    | Drains                                                                                                          | Source                                  |
| --------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `GET /api/automations/cron` | Due `automation_pending_executions` rows — resumes each one from its parked step via `resumePendingExecution()` | `src/app/api/automations/cron/route.ts` |
| `GET /api/flows/cron`       | `flow_runs` past their timeout → marks `timed_out`, writes a `flow_run_events` audit row                        | `src/app/api/flows/cron/route.ts`       |

Both:

- Require the header `x-cron-secret: <AUTOMATION_CRON_SECRET>`,
  compared with `crypto.timingSafeEqual`. Return `401` on a mismatch,
  `503` if the env var isn't set at all.
- Are safe to call repeatedly and concurrently. `/api/automations/cron`
  claims each row (`status: 'pending' → 'running'`) with a conditional
  update before processing it, so two overlapping calls don't
  double-send the same recovery message. `/api/flows/cron` guards its
  update with `.eq('status', 'active')`, so a run that already advanced
  or was swept by a parallel call is left alone.
- Do the real work themselves — there is no separate queue consumer.
  Calling the endpoint _is_ running the sweep.
- Are cheap to poll on a schedule tighter than your shortest `Wait`
  step or timeout; a `Wait` fires up to one poll interval late, never
  early.

Neither endpoint schedules itself. **Something external has to call
them on a timer**, or parked work sits forever — which is exactly the
symptom of "tags apply instantly but the timed follow-up never sends."

## How it's driven here: the `cron` sidecar

`docker-compose.yml` defines a second service, `cron`, next to `app`:

- Image: `curlimages/curl` (no custom build, no `docker.sock` access).
- Loop: `curl` both endpoints, sleep 300s, repeat — so it also fires
  once immediately on container start/restart rather than waiting a
  full 5 minutes.
- Talks to `app` over the internal Compose network
  (`http://app:3000/...`), so no port needs to be published for it.
- Reads `AUTOMATION_CRON_SECRET` from the same `env_file: .env.local`
  as `app` — one value, one place to rotate it.
- `depends_on: app: condition: service_healthy` — it only starts
  polling once `app`'s own healthcheck passes.
- If `AUTOMATION_CRON_SECRET` is unset, it logs a warning and idles
  instead of hammering a `503` every 5 minutes.

This requires no host-level cron, no `docker.sock` mount, and no
changes beyond the compose file — it runs as-is under EasyPanel's
**Compose** service type. (It does **not** run under EasyPanel's
single-container **App** service type, which only starts one service
from a Dockerfile — see below.)

### Setup

1. Set `AUTOMATION_CRON_SECRET` in `.env.local` (generate one with
   `openssl rand -hex 32`; keep it identical to whatever the `app`
   service reads — same file, so this is automatic if you're editing
   `.env.local` directly).
2. `docker compose --env-file .env.local up --build -d` (or redeploy
   in EasyPanel). The `cron` container starts alongside `app`.
3. Verify it's polling: `docker compose logs -f cron` should show
   lines like:

   ```
   [cron] starting, polling every 5 minutes
   [cron] 2026-09-09T18:00:01Z /api/automations/cron -> 200
   [cron] 2026-09-09T18:00:01Z /api/flows/cron -> 200
   ```

   A `503` on either line means `AUTOMATION_CRON_SECRET` isn't visible
   to the `app` container (env file not loaded / stale container).
   A `401` means the two services disagree on the secret's value.

### EasyPanel note

If this app was deployed in EasyPanel as a **single "App" service**
(Dockerfile-only, no compose), the `cron` sidecar in
`docker-compose.yml` never gets created — EasyPanel only builds the
one service you pointed it at. Switch the project to EasyPanel's
**Compose** service type (point it at this repo's
`docker-compose.yml`) so both `app` and `cron` come up together, and
set `AUTOMATION_CRON_SECRET` as an environment variable on the project
(or in the `.env.local` EasyPanel injects) so both services see the
same value.

## Alternatives to the sidecar

The sidecar is one valid choice among several — any mechanism that
issues `GET` requests with the right header on a schedule works
identically:

- **Vercel Cron** (`vercel.json` → `crons`) if hosting on Vercel
  instead of Docker.
- **GitHub Actions** on a `schedule:` trigger, running two `curl`
  steps — works from any host, needs the deployment's public URL.
- **External pinger** (cron-job.org, EasyCron, …) hitting the public
  URL — simplest option if you don't want any extra container, but
  depends on a third party and requires the endpoints to be reachable
  from the public internet.

Whichever you use, a 5-minute interval is a reasonable default: tight
enough that a 1-minute `Wait` step is never more than ~5 minutes late,
and cheap enough not to matter at low-to-moderate account volume. A
1-hour interval is fine if the account only ever uses `Wait` steps of
an hour or longer and flow-timeout sweeps aren't time-sensitive.
