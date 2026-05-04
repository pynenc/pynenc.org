---
layout: post
title: "Distribute your Python app without rewriting it"
subtitle: "One decorator. One environment variable. Zero refactoring."
date: 2026-04-24 00:00:00 +0000
categories: [publications, direct-task]
tags: [python, distributed-systems, migration, pynenc]
author: Jose Diaz
share-img: /assets/img/shared/pynenc_runners_timeline_detail.png
description: "One decorator. One environment variable. Five reports go from 2.51 seconds to 0.54 seconds. Zero call sites change. Here is how to distribute a Python app without rewriting it."
keywords: "python distributed computing, task distribution, zero refactoring, async tasks, pynenc, background workers, parallel processing"
---

You have a Python function that processes one item. You call it in a loop over a list. The list grows. The loop slows down. The work is real — an LLM API call, an embedding, a scrape, a database query, a model inference — the kind of thing that does not get faster with prettier code.

Distribution is the answer. Distribution usually means rewriting every call site to handle queues, futures, and result objects. So the loop stays slow and a progress bar gets added.

This post is about removing the migration cost. **One decorator. One environment variable. Five reports go from 2.51 seconds to 0.54 seconds. Zero call sites change.**

The whole demo is in the [direct_task_demo](https://github.com/pynenc/samples/tree/main/direct_task_demo) sample of the [pynenc samples](https://github.com/pynenc/samples) repository. The example happens to generate sales reports because it needs a concrete I/O-bound function with a list-shaped input — but the pattern is the same for batch LLM calls, embedding generation, RAG indexing, web scraping, ETL enrichment, or any workload of the form "slow function, list of items, want it parallel".

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

Setting `PYNENC__DEV_MODE_FORCE_SYNC_TASKS=True` runs every decorated call inline in the caller's thread — no runner, no broker, no database writes. Behaviour is identical to `tasks_original.py`: 5 reports in 2.52s, same values, same order. This is the strangler-fig migration pattern: decorate one function at a time, keep the env var on so existing tests stay green, then remove it in production. No call site needs to change.

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

Two patterns appear here. The sequential loop is the original code, unchanged — each `generate_report(p)` blocks before the next call starts. That is by design: `@app.direct_task` preserves the calling contract of a regular Python function. The caller waits, gets the value back, and exception handling works as it always did. That guarantee is what makes the migration zero-cost.

For caller-side concurrency, `ThreadPoolExecutor` is the standard Python pattern, and it composes naturally:

```python
from concurrent.futures import ThreadPoolExecutor

with ThreadPoolExecutor(max_workers=len(PERIODS)) as pool:
    reports = list(pool.map(generate_report, PERIODS))
```

Each thread blocks on its own call; the runner processes them in parallel. Five reports in 0.54 seconds — five times faster on the same machine, with no broker change.

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

The function signature is honest. Nothing is "ignored". The argument the caller passes is the argument `parallel_func` reads.

For higher throughput, pynenc's native parallel API goes further: instead of aggregating before returning, the function exposes a result group that the caller can iterate as results arrive. Each item is available as soon as the worker that produced it finishes — no waiting for the slowest one. The `parallel_func` pattern shown here is the zero-migration-cost option: same signature, same return type, same call site, parallelism handled entirely by the decorator.

## Why not just use `asyncio` / `multiprocessing` / Celery?

These are the obvious alternatives and each one solves a different slice of the problem.

- **`asyncio.gather`** parallelises async I/O on a single event loop. It works only if the function is already `async`, only on one machine, and only for I/O-bound work. Synchronous functions need to be rewritten.
- **`multiprocessing.Pool.map`** parallelises across CPU cores on a single host. It cannot scale beyond one machine, struggles with large arguments (everything is pickled and copied), and the call site changes from `f(x)` to `pool.map(f, xs)`.
- **`concurrent.futures.ThreadPoolExecutor`** is a clean primitive but stops at the process boundary. With `@app.direct_task` it composes — use it on the caller side and pynenc handles the worker side, optionally on different machines.
- **Celery / RQ / Dramatiq** scale across machines but break the calling contract: `f(x)` becomes `f.delay(x).get()` or similar. Every call site has to change. There is no in-process sync mode for unit tests — you run a worker or you mock.

`@app.direct_task` is the option that gives you all three properties at once: distributed across machines, the call site does not change, and a single environment variable runs everything inline for tests and local development.

## When `direct_task` is the right tool

`@app.direct_task` always blocks the caller. That is the point: it preserves the calling contract that the original code already relied on. Migration is a copy-the-decorator operation, not a rewrite.

For fire-and-forget semantics — enqueue work and continue without blocking — `@app.task` is the right decorator. It returns an `Invocation` and exposes `.result` for explicit waiting. The two decorators are complementary; the right choice is whichever one preserves the call pattern the codebase already has.

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
