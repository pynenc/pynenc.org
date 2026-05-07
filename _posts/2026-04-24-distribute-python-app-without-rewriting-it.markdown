---
layout: post
title: "Distribute a Python function without changing callers"
subtitle: "Use direct_task for blocking calls, sync tests, and worker execution."
date: 2026-04-24 00:00:00 +0000
categories: [publications, direct-task]
tags: [python, distributed-systems, migration, pynenc]
author: Jose Diaz
share-img: /assets/img/shared/pynenc_runners_timeline_detail.png
description: "How pynenc direct_task lets existing Python functions run on workers while keeping call sites unchanged, with sync mode for tests and local development."
keywords: "python distributed computing, task distribution, direct task, sync task testing, pynenc, background workers, parallel processing"
---

You have a Python function that processes one item. You call it in a loop. The list grows, and the loop slows down because each call waits on I/O: an API request, a database query, a scrape, an embedding, a model call.

Parallel execution can help. The hard part is migration. In many task systems, `result = f(x)` becomes "enqueue this, keep a handle, wait for the result somewhere else." That is a real rewrite when the function is already used across a codebase.

`@app.direct_task` is for the case where the existing call shape matters. In sync mode, the call runs inline. With a runner, the same call is executed by a worker and the caller waits for the returned value. The caller still writes `result = f(x)`.

The sample uses five report jobs because the timings are easy to see: sequential execution takes about 2.5 seconds, and worker execution with caller-side concurrency takes about 0.5 seconds on this workload. The whole demo is in [direct_task_demo](https://github.com/pynenc/samples/tree/main/direct_task_demo).

## The original code

`tasks_original.py` is plain Python. No decorators, no imports from any framework, no infrastructure assumptions. It does what the existing codebase already does:

```python
# tasks_original.py
import time
from hashlib import md5

PERIODS = ["Q1-2025", "Q2-2025", "Q3-2025", "Q4-2025", "Q1-2026"]


def _build_report(period: str) -> dict:
    time.sleep(0.5)  # simulates DB queries + aggregation
    seed = int(md5(period.encode()).hexdigest()[:8], 16)
    revenue = 50_000 + (seed % 950_000)
    orders = 100 + (seed % 9_900)
    return {"period": period, "revenue": revenue, "orders": orders,
            "avg_order_value": round(revenue / orders, 2)}


def generate_report(period: str) -> dict:
    return _build_report(period)


def generate_reports(periods: list[str]) -> list[dict]:
    return [_build_report(p) for p in periods]
```

Running it produces five reports in 2.51 seconds. That is the baseline.

## The migration

`tasks.py` is the same file with three additions:

```diff
+ from pynenc import Pynenc
+ app = Pynenc()
 
+ @app.direct_task
  def generate_report(period: str) -> dict:
      return _build_report(period)
 
+ @app.direct_task(parallel_func=_per_period, aggregate_func=_flatten)
  def generate_reports(periods: list[str]) -> list[dict]:
      return [_build_report(p) for p in periods]
```

Function bodies, signatures, and return types are identical. The two helpers `_per_period` and `_flatten` are added to support the parallel decorator — they read the caller's actual arguments, they do not synthesize anything out of thin air:

```python
def _per_period(args: dict) -> list[tuple[list[str]]]:
    return [([p],) for p in args["periods"]]


def _flatten(chunks: list[list[dict]]) -> list[dict]:
    return [report for chunk in chunks for report in chunk]
```

`_per_period` reads the `periods` argument the caller passed and yields one period per worker. `_flatten` collects the per-worker results back into a single list. The decorator does the routing.

## Sync mode: the decorators are inert

Setting `PYNENC__DEV_MODE_FORCE_SYNC_TASKS=True` runs every decorated call inline in the caller's thread: no runner, no broker, no database writes. Behaviour is identical to `tasks_original.py`: 5 reports in 2.52s, same values, same order.

That makes the migration incremental. You can decorate one function, keep sync mode on while tests and local development continue to call it normally, then run the same function through workers when you are ready.

```text
$ PYNENC__DEV_MODE_FORCE_SYNC_TASKS=True python sample_sync.py

Sync mode: 5 reports in 2.52s (expected ~2.5s — sequential, like the original)
  Q1-2025     revenue=$  477,381  orders=  381  AOV=$1252.97
  Q2-2025     revenue=$  798,638  orders= 7838  AOV=$101.89
  ...
```

## Distributed mode: the same calls, with workers

Removing the env var and starting a `ThreadRunner` makes the decorators distribute work over a SQLite-backed broker. The call sites do not change:

```text
$ python sample_distributed.py

Sequential calls on runner: 5 reports in 3.18s (each call blocks before the next starts)

Concurrent caller threads: 5 reports in 0.54s (N caller threads -> N workers running in parallel)
  Q1-2025     revenue=$  477,381  ...
  ...
```

Two patterns appear here. The sequential loop is the original code, unchanged: each `generate_report(p)` blocks before the next call starts. That is by design. `@app.direct_task` preserves the way a normal Python function is called: the caller waits, gets the value back, and exceptions are raised in the caller.

For caller-side concurrency, `ThreadPoolExecutor` is the standard Python pattern, and it composes naturally:

```python
from concurrent.futures import ThreadPoolExecutor

with ThreadPoolExecutor(max_workers=len(PERIODS)) as pool:
    reports = list(pool.map(generate_report, PERIODS))
```

Each thread blocks on its own call; the runner processes them in parallel. Five reports finish in 0.54 seconds in this local I/O-bound demo.

## Single-call fan-out

Sometimes the parallelism belongs inside the function rather than at the call site. The caller passes a list, expects a list back, and does not need to change a single line of code. That is what `parallel_func` is for: a small helper that describes how to split the arguments into individual work items. Pynenc dispatches one task per item — across whatever workers are running — then reassembles the results via `aggregate_func` before returning to the caller:

```python
# tasks.py
@app.direct_task(parallel_func=_per_period, aggregate_func=_flatten)
def generate_reports(periods: list[str]) -> list[dict]:
    return [_build_report(p) for p in periods]
```

The caller calls it exactly as in `tasks_original.py`:

```python
reports = generate_reports(periods=PERIODS)
```

Behind the decorator, `_per_period` reads `args["periods"]` and yields one argument tuple per period. Pynenc triggers one task per tuple and routes each to an available worker. `_flatten` collects the per-worker results back into a single list. The caller receives the same shape it always did:

```text
$ python sample_parallel.py

Parallel fan-out: 5 reports in 0.65s (one call, 5 workers running in parallel)
```

The argument the caller passes is the argument `parallel_func` reads. The function still returns the same list shape as before.

For higher throughput, pynenc also supports result groups that the caller can iterate as results arrive. The `parallel_func` pattern shown here is the lower-migration option: same signature, same return type, same call site, and parallelism handled by the decorator.

## How this differs from other Python concurrency tools

Several standard tools help with concurrency, but they change different parts of the program:

- **`asyncio`** is a good fit when the code is already async I/O. A synchronous function still needs adaptation.
- **Thread and process pools** are good local primitives. The caller owns the pool and the work stays inside one host or process boundary.
- **Traditional task queues** scale work out to workers, but the call usually changes from a direct function call to a submit/wait/result API.

`@app.direct_task` is for the overlap: run work on pynenc workers, keep the direct call form, and keep a sync mode for tests and local development.

## When `direct_task` is the right tool

`@app.direct_task` always blocks the caller. That is the point: it preserves the behaviour the original code already relied on. Migration can happen one function at a time.

For work that should be enqueued while the caller continues immediately, `@app.task` is the right decorator. It returns an `Invocation` and exposes `.result` for explicit waiting. The two decorators are complementary; the right choice is the one that matches the call pattern your code already has.

## Try it

```bash
# uv: https://docs.astral.sh/uv/getting-started/installation/
git clone https://github.com/pynenc/samples.git
cd samples/direct_task_demo
uv sync

uv run python tasks_original.py                                       # baseline
PYNENC__DEV_MODE_FORCE_SYNC_TASKS=True uv run python sample_sync.py   # decorators inert
uv run python sample_distributed.py                                   # workers, two patterns
uv run python sample_parallel.py                                      # single-call fan-out
```

## Further reading

- [pynenc](https://github.com/pynenc/pynenc) — the framework
- [direct_task usage guide](https://docs.pynenc.org/usage_guide/use_case_008_direct_task.html) — full documentation
- [pynenc samples](https://github.com/pynenc/samples) — runnable demos
- [GitHub Discussions](https://github.com/pynenc/pynenc/discussions) — open questions, feedback
