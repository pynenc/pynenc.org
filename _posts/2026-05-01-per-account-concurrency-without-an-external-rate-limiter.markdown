---
layout: post
title: "Task concurrency by key arguments, tune API consumption with pynenc"
subtitle: "One slot per account key, full throughput across all others — no lock sidecar, two decorator flags."
date: 2026-05-01 00:00:00 +0000
categories: [publications, concurrency]
tags: [python, fastapi, external-apis, concurrency-control, distributed-systems, pynenc]
author: Jose Diaz
share-img: /assets/img/posts/2026-05-02-all-tests-timeline.png
description: "Use Pynenc keyed concurrency to run Python background workers in parallel across SaaS client accounts while preventing overlapping calls for the same account. FastAPI demo, no Redis lock service."
keywords: "python concurrency, per-account rate limiting, task queue, SaaS background jobs, pynenc, distributed systems, FastAPI, async workers"
---

You run a SaaS. Your customers are companies — let's call them client
accounts. In the background, your workers call an external data provider on
behalf of each client: fetch their profile, list their invoices, refresh
their usage, push a metadata update. The provider issues credentials
*per client account*, and its quota limits apply *per client*: you can
hammer the provider with calls for fifty different clients in parallel, but
run two calls for the same client at the same time and it throttles that
account, drops the request, or returns inconsistent data.

You want maximum throughput — saturate your worker pool across all clients.
But for any *single* client, only one call may be in flight at a time. That
constraint lives at the account boundary, not at the API-key level.

That is where a lot of Python background job systems get awkward. With
enough workers, two of them eventually grab work for the same client in
parallel. The provider throttles that client's account, and now you have a
support ticket and a partial sync to reconcile.

The advice on the internet is some combination of:

- "Add Redis and a per-key lock service."
- "Run one worker per client account." (Fine for 5 clients. Absurd at 200.)
- "Use a rate limiter with token buckets and exponential backoff."

There is a simpler option, and if you already use pynenc you already have
it. **Two flags on `@app.task` make the orchestrator enforce: at most one
in-flight invocation per client account key, full parallelism across
different clients, and — if you want it — duplicates collapsed before they
ever reach a worker.**

Full sample: [samples/concurrency_demo](https://github.com/pynenc/samples/tree/main/concurrency_demo).

## The setup

Four tiny files, each doing one thing:

```text
concurrency_demo/
├── api_server.py     # tiny FastAPI: pretends to be the external provider
├── tasks.py          # PynencBuilder app + 4 tasks (the whole story)
├── enqueue.py        # CLI: enqueue one scenario, print results
└── sample.py         # one-command demo: boots api+worker, runs all scenarios
```

The "external provider" is a FastAPI app that holds an account in flight for
0.4 seconds per call and records a *collision* whenever a second request
arrives while the first is still in flight — a stand-in for the 429s and
silent inconsistencies a real provider would produce:

```python
# api_server.py — the part that matters
@app.post("/call/{account_id}/{op}")
async def call(account_id: str, op: str, hold: float = HOLD_SECONDS) -> dict[str, str]:
    async with lock:
        acc = accounts[account_id]
        acc.calls += 1
        collided = acc.in_flight > 0
        acc.collisions += int(collided)
        acc.in_flight += 1
    print(f"  [{'COLLISION' if collided else 'ok       '}] {account_id:<8} {op}", flush=True)

    await asyncio.sleep(hold)

    async with lock:
        accounts[account_id].in_flight -= 1
    return {"outcome": "collision" if collided else "ok"}
```

The pynenc app and the four tasks fit on one screen. The whole pynenc
configuration — SQLite backend, in-process thread runner, logging — sits
fluently in `tasks.py` next to the tasks that use it:

```python
# tasks.py
import os
import httpx
from pynenc import PynencBuilder
from pynenc.conf.config_task import ConcurrencyControlType as Mode

API_URL = "http://127.0.0.1:8765"

app = (
    PynencBuilder()
    .app_id("concurrency_demo")
    .sqlite("concurrency_demo.db")
    .thread_runner(min_threads=1, max_threads=8)
    .logging_stream("stdout")
    .logging_level(os.environ.get("DEMO_LOG_LEVEL", "info"))
    .max_pending_seconds(3.0)
    .build()
)


def _hit(account_id: str, op: str, hold: float | None = None) -> str:
    params = {"hold": hold} if hold is not None else None
    r = httpx.post(f"{API_URL}/call/{account_id}/{op}", params=params, timeout=10.0)
    r.raise_for_status()
    return r.json()["outcome"]


@app.task
def call_unsafe(account_id: str, op: str) -> str:
    return _hit(account_id, op)


@app.task(
    running_concurrency=Mode.KEYS,
    key_arguments=("account_id",),
    reroute_on_concurrency_control=True,
)
def call_keyed(account_id: str, op: str) -> str:
    return _hit(account_id, op)


@app.task(
    running_concurrency=Mode.KEYS,
    key_arguments=("account_id",),
    reroute_on_concurrency_control=False,
)
def call_keyed_drop(account_id: str, op: str) -> str:
    return _hit(account_id, op)


@app.task(
    running_concurrency=Mode.KEYS,
    registration_concurrency=Mode.KEYS,
    key_arguments=("account_id",),
    reroute_on_concurrency_control=True,
)
def refresh_once(account_id: str) -> str:
    return _hit(account_id, "refresh")
```

## How to run it

You can launch the demo two ways. The four-terminal flow is the one to use
when you want to *watch* what each component is doing — the API printing
collisions in real time, the worker logging task lifecycle, and the pynenc
monitoring page visualising the orchestrator state. The one-command flow
boots the API and the worker as subprocesses and runs all scenarios in
sequence; it's how CI runs the sample.

```bash
# four terminals — recommended for exploring
uv run uvicorn api_server:app --port 8765      # 1. API
uv run pynenc --app tasks.app runner start     # 2. worker
uv run pynenc monitor                          # 3. monitor (optional) at http://127.0.0.1:8000
uv run python enqueue.py all                   # 4. enqueue scenarios
```

```bash
# one command — recommended for CI
uv run python sample.py
```

## What the API observes

All four scenarios, end to end, on a single pynmon timeline. Read it left
to right: scenario A bursts open with eight overlapping bars (the
collisions); B fans out into three lanes that strictly serialise per
account; C is over almost immediately because most invocations land in
`CONCURRENCY_CONTROLLED_FINAL`; D collapses 24 enqueues into three calls
before a worker ever sees them.

![All four scenarios on one pynmon invocation timeline](/assets/img/posts/2026-05-02-all-tests-timeline.png)

Four scenarios, four stories. Each one below pairs the per-scenario
summary, the API server's collision log, and the matching pynmon timeline.

### Scenario A — no concurrency control

The baseline pain. Different provider operations, same `account_id` key.
The runner can hold up to eight invocations in flight, and it does — most
of the 12 invocations start essentially together. The first call per
account reaches the provider cleanly; everything that overlaps the same
account is recorded as `COLLISION` — the stand-in for a real 429,
throttle, or inconsistent response.

```text
=== A. unsafe — no concurrency control ===
  12 enqueued -> 12 calls, 9 collisions, 1.42s
   X acme     calls=4  collisions=3
   X globex   calls=4  collisions=3
   X initech  calls=4  collisions=3

--- reset @ 11:49:40 A. unsafe — no concurrency control ---
  [ok       ] acme     fetch_profile
  [COLLISION] acme     list_invoices
  [ok       ] globex   fetch_profile
  [COLLISION] acme     update_metadata
  [COLLISION] acme     refresh_usage
  [COLLISION] globex   refresh_usage
  [COLLISION] globex   list_invoices
  [COLLISION] globex   update_metadata
  [ok       ] initech  fetch_profile
  [COLLISION] initech  list_invoices
  [COLLISION] initech  refresh_usage
  [COLLISION] initech  update_metadata
```

![Scenario A timeline — 12 invocations, four per account, all running in parallel, nine recorded as collisions](/assets/img/posts/2026-05-02-tests-A-call-unsafe.png)

### Scenario B — `running_concurrency=KEYS`, `reroute=True`

Same 12 calls as A, zero collisions. The orchestrator indexes invocation
arguments and refuses to start a second `call_keyed` while one with the
same `account_id` is already running. When a worker tries to pick up a
blocked invocation, `reroute_on_concurrency_control=True` puts it back on
the queue so it retries when the slot frees up. The timeline shows three
clean lanes — one per account — with the non-leading invocations bouncing
through `REROUTED` until they get their turn.

```text
=== B. keyed — running_concurrency=KEYS, reroute=True ===
  12 enqueued -> 12 calls, 0 collisions, 2.14s
  OK acme     calls=4  collisions=0
  OK globex   calls=4  collisions=0
  OK initech  calls=4  collisions=0

--- reset @ 11:49:41 B. keyed — running_concurrency=KEYS, reroute=True ---
  [ok       ] acme     fetch_profile
  [ok       ] globex   fetch_profile
  [ok       ] initech  fetch_profile
  [ok       ] initech  list_invoices
  [ok       ] acme     update_metadata
  [ok       ] globex   list_invoices
  [ok       ] initech  refresh_usage
  [ok       ] globex   update_metadata
  [ok       ] acme     refresh_usage
  [ok       ] globex   refresh_usage
  [ok       ] initech  update_metadata
  [ok       ] acme     list_invoices
```

![Scenario B timeline — three serial lanes (one per account), parallel across accounts, blocked invocations rerouted until their slot opens](/assets/img/posts/2026-05-02-tests-B-call-keyed.png)

### Scenario C — `running_concurrency=KEYS`, `reroute=False`

Same guard, opposite policy. `reroute_on_concurrency_control=False` tells
the orchestrator not to re-queue blocked invocations — they land in
`CONCURRENCY_CONTROLLED_FINAL` and `inv.result` raises `KeyError`. Only
the first invocation per `account_id` ever reaches the provider; the other
nine are dropped. The timeline ends almost as soon as the first three
invocations finish.

```text
=== C. drop — running_concurrency=KEYS, reroute=False ===
  12 enqueued -> 3 calls (9 dropped), 0 collisions, 0.67s
  OK acme     calls=1  collisions=0
  OK globex   calls=1  collisions=0
  OK initech  calls=1  collisions=0

--- reset @ 11:49:43 C. drop — running_concurrency=KEYS, reroute=False ---
  [ok       ] acme     fetch_profile
  [ok       ] globex   fetch_profile
  [ok       ] initech  fetch_profile
```

![Scenario C timeline — three running invocations, the other nine dropped to CONCURRENCY_CONTROLLED_FINAL](/assets/img/posts/2026-05-02-tests-C-call-keyed-drop.png)

### Scenario D — `registration_concurrency=KEYS` + `running_concurrency=KEYS`

A different question. `registration_concurrency` checks at *enqueue*
time: when refresh request number two for `acme` arrives, there is
already one registered, so the producer gets back a `ReusedInvocation`
pointing to the first. 24 logical “please refresh this account” events —
eight per client account — collapse to 3 actual API calls before a worker
ever picks them up. The `running_concurrency` guard is the safety net for
the rare case where the worker is unusually fast and picks up the first
task before all duplicates have registered.

```text
=== D. dedupe — registration + running KEYS ===
  24 enqueued -> 3 calls (21 deduped), 0 collisions, 0.57s
  OK acme     calls=1  collisions=0
  OK globex   calls=1  collisions=0
  OK initech  calls=1  collisions=0

--- reset @ 11:49:44 D. dedupe — registration + running KEYS ---
  [ok       ] acme     refresh
  [ok       ] globex   refresh
  [ok       ] initech  refresh
```

![Scenario D timeline — 24 enqueues collapse to 3 invocations at registration time, one per account](/assets/img/posts/2026-05-02-tests-D-call-refresh-once.png)

## When to reach for which

The pattern generalises cleanly. Your SaaS calls a third-party provider on
behalf of each client — think Salesforce, HubSpot, Stripe, GitHub Apps,
Shopify, or any OAuth-based integration where each client has their own
credentials and their own rate-limit bucket. The provider doesn't care how
many different client accounts you query in parallel; it only throttles when
you fire two requests against the *same* client account simultaneously. That
is the quota boundary the orchestrator needs to respect.

The two settings cover most of what people reach for an external
rate-limiter or a per-tenant lock service for:

- **`running_concurrency=KEYS` on `account_id` (or `tenant_id`, or
  `oauth_installation_id`, or `client_token`), with `reroute=True`** — when
  the rule is “no two calls in flight for the same client account”, but you
  still want all calls to eventually complete. Blocked calls re-queue and
  retry until a slot opens. Good for distinct operations (op1, op2, op3…)
  that all need to run.
- **Same, with `reroute=False`** — when the rule is “if a call for this
  account is already running, drop the new one”. Queue depth stays flat;
  no retry buildup. Good for “trigger a refresh, but if one is already in
  flight, skip it”.
- **`registration_concurrency=KEYS` + `running_concurrency=KEYS` on the
  same key** — when "do this once per client right now" is enough,
  regardless of how many places triggered it. "Refresh client dashboard",
  "rebuild client index", "regenerate client report". A noisy internal
  event bus firing the same refresh 50 times per second is a bug; deduping
  it before it reaches a worker keeps queue depth honest. The running guard
  is the safety net: if a worker is fast enough to pick up the first task
  before all duplicates register, the second flag prevents a parallel run.
  Together they guarantee exactly one call per account, regardless of
  timing. Scenario D in the sample.

And — the part that matters in production — there is no extra lock service.
No Redis lock library. No rate-limiter sidecar. The orchestrator already
tracks invocations to do its job; checking for an existing one with the
same key is the same kind of lookup.

## Simpler scopes when you don't need keys

This post zooms in on `KEYS`, but it is one of four scopes. The same two
flags (`running_concurrency` and `registration_concurrency`) accept any
value of `ConcurrencyControlType`:

- **`DISABLED`** — the default. No concurrency check.
- **`TASK`** — at most one invocation of *the task itself* in the chosen
  state, regardless of arguments. “Only one nightly cleanup may run.”
- **`ARGUMENTS`** — at most one invocation per *full* argument tuple. Two
  calls with identical arguments collapse; calls that differ in any
  argument run in parallel. “Don't run the same export twice.”
- **`KEYS`** — at most one invocation per chosen *subset* of arguments
  (`key_arguments=(...)`). The mode this post is about: serialise on the
  account key, ignore the operation name.

The scope you pick controls *what counts as a duplicate*. The flag you put
it on (`registration_concurrency` vs `running_concurrency`) controls
*when the check happens* — at enqueue time or at run time.

Full reference, including how `key_arguments` interacts with each scope and
the other concurrency knobs, is in the pynenc docs:
[Concurrency Control use case](https://docs.pynenc.org/en/latest/usage_guide/use_case_003_concurrency_control.html).

## What's not in the box yet

Two things people will (correctly) ask for:

- **Multi-slot concurrency** — "up to 5 in flight per key", not just 1.
- **Time-window rate limits** — "100 calls per minute per key".

Both are on the roadmap. The current primitive — *exactly one in-flight
invocation per key for a task* — already covers a common integration
problem: external APIs that allow parallelism across accounts but not
overlapping calls for the same account. The bigger ones build on the same
orchestrator machinery.

## How to try it

```bash
git clone https://github.com/pynenc/samples
cd samples/concurrency_demo
uv sync
uv run python sample.py
```

The full sample, the FastAPI server, and the README are at
[github.com/pynenc/samples/tree/main/concurrency_demo](https://github.com/pynenc/samples/tree/main/concurrency_demo).
The pynenc framework is on PyPI as
[`pynenc`](https://pypi.org/project/pynenc/) and the source is at
[github.com/pynenc/pynenc](https://github.com/pynenc/pynenc). Issues, ideas,
and "this would be great if it also did X" comments are welcome.
