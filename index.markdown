---
title: Pynenc
subtitle: Distributed task orchestration for Python
layout: page
---

<div class="badges">
<img alt="pypi version" src="https://img.shields.io/pypi/v/pynenc">
<img alt="python" src="https://img.shields.io/pypi/pyversions/pynenc.svg">
<img alt="docs" src="https://img.shields.io/readthedocs/pynenc">
<img alt="license" src="https://img.shields.io/github/license/pynenc/pynenc">
<img alt="stars" src="https://img.shields.io/github/stars/pynenc/pynenc">
<img alt="last commit" src="https://img.shields.io/github/last-commit/pynenc/pynenc">
</div>

Pynenc is a Python distributed task system built around the problems other task frameworks leave for you to solve: lost tasks, duplicate work, dependency deadlocks, and failures you can't debug<img class="shroom-dot" src="/assets/img/pynenc_logo.png" alt="">

<div class="oss-callout">
<img class="shroom-float-right" src="/assets/img/pynenc_logo.png" alt="">
<strong>100% open source. No strings attached.</strong><br>
No paid cloud edition, no premium tier, no enterprise upsell. Core, plugins, and monitoring are MIT-licensed.
</div>

## What Pynenc solves

### 1. Tasks disappear when workers crash

**Pynenc tracks every invocation through a strict state machine** with ownership semantics and runner heartbeats. Dead runners are detected automatically; orphaned invocations are reclaimed and re-routed<img class="shroom-dot" src="/assets/img/pynenc_logo.png" alt="">

### 2. Duplicate work runs in parallel

**Built-in concurrency control** with four modes: `DISABLED`, `TASK` (one per task), `ARGUMENTS` (one per unique args), `KEYS` (one per arbitrary key). Duplicates are rejected before reaching a worker.

### 3. Dependencies deadlock your workers

Task A waits on B, B waits on C, all workers blocked. **Pynenc's orchestrator pauses waiting tasks to free their slots**, then **prioritizes by dependency count** — the task blocking the most others runs first. Dependency chains resolve without holding threads hostage.

### 4. Failures are impossible to debug

**Pynmon** (built-in monitoring UI) provides SVG timelines showing when each invocation started, paused, resumed, and finished across all runners. Family trees show parent-child relationships. The log explorer turns raw logs into clickable cross-references.

<img src="/assets/img/pynmon_timeline.png" alt="Pynmon execution timeline showing task execution across multiple runners with status transitions" class="pynmon-screenshot lightbox-target">

### 5. Switching backends requires rewriting code

**Plugin architecture.** Core ships with memory and SQLite. Redis, MongoDB, and RabbitMQ install as separate packages. Swap by config, not code.

<div class="shroom-divider"><img src="/assets/img/pynenc_logo.png" alt="~"></div>

## Quick start

```bash
pip install pynenc
```

```python
from pynenc import Pynenc

app = Pynenc()

@app.task
def add(x: int, y: int) -> int:
    return x + y

result = add(1, 2).result  # 3
```

```bash
pynenc --app=tasks.app runner start
```

<div class="disclaimer-box">
<img class="shroom-sm" src="/assets/img/pynenc_logo.png" alt=""> <strong>Fine print:</strong> this runs in-memory on a single thread. For distributed execution, add a backend:
<code>pip install pynenc-redis</code> / <code>pynenc-mongodb</code> / <code>pynenc-rabbitmq</code>
</div>

More in the [Usage Guide](https://docs.pynenc.org/en/latest/usage_guide/index.html) and [samples repo](https://github.com/pynenc/samples)<img class="shroom-dot" src="/assets/img/pynenc_logo.png" alt="">

<div class="shroom-divider"><img src="/assets/img/pynenc_logo.png" alt="~"></div>

## Under the hood <img class="shroom-sm" src="/assets/img/pynenc_logo.png" alt="">

**Invocation state machine** — Every task call becomes an invocation moving through `REGISTERED → PENDING → RUNNING → SUCCESS/FAILED`. Transitions are enforced; each change is recorded with timestamps and ownership metadata.

**Recovery** — Runners emit heartbeats. A background atomic service detects dead runners and invocations stuck beyond configured thresholds. Orphaned work is reclaimed under a distributed lock and re-queued transparently.

**Workflows** — Multi-step workflows with result persistence. On replay, completed steps are skipped; failed workflows resume from the last checkpoint, not from the start.

<div class="shroom-divider"><img src="/assets/img/pynenc_logo.png" alt="~"></div>

## Features <img class="shroom-sm" src="/assets/img/pynenc_logo.png" alt="">

<div class="feature-grid">
<div class="feature-card">
<h4>🔌 Plugin Architecture</h4>
<p>Memory &amp; SQLite built-in. Redis, MongoDB, RabbitMQ as separate packages.</p>
</div>
<div class="feature-card">
<h4>🔄 Auto Orchestration</h4>
<p>Waiting tasks are paused, slots freed. Highest-dependency tasks run first. No deadlocks.</p>
</div>
<div class="feature-card">
<h4>🚦 Concurrency Control</h4>
<p>Four modes prevent duplicate work before it reaches a worker.</p>
</div>
<div class="feature-card">
<h4>📊 Monitoring (Pynmon)</h4>
<p>SVG timelines, family trees, log explorer, runner dashboards, workflow tracking.</p>
</div>
<div class="feature-card">
<h4>⚡ Workflows</h4>
<p>Deterministic replay, checkpoint persistence, resume from failure.</p>
</div>
<div class="feature-card">
<h4>🔒 Recovery</h4>
<p>Heartbeats + dead runner detection. Orphaned invocations reclaimed automatically.</p>
</div>
<div class="feature-card">
<h4>⏰ Triggers</h4>
<p>Cron, events, task-status — composable with AND/OR logic.</p>
</div>
<div class="feature-card">
<h4>🔍 Debuggability</h4>
<p>Every state transition recorded. Logs correlate to invocations, runners, tasks.</p>
</div>
</div>

<div class="shroom-divider"><img src="/assets/img/pynenc_logo.png" alt="~"></div>

## Plugin system <img class="shroom-sm" src="/assets/img/pynenc_logo.png" alt="">

| Plugin | Package | Provides |
|---|---|---|
| Redis | `pynenc-redis` | Broker, Orchestrator, State Backend, Trigger |
| MongoDB | `pynenc-mongodb` | Broker, Orchestrator, State Backend, Trigger |
| RabbitMQ | `pynenc-rabbitmq` | Broker |

```python
from pynenc.builder import PynencBuilder

app = (
    PynencBuilder()
    .app_id("my_app")
    .redis(url="redis://localhost:6379")
    .multi_thread_runner(min_threads=2, max_threads=8)
    .build()
)
```

## Monitoring with Pynmon <img class="shroom-sm" src="/assets/img/pynenc_logo.png" alt="">

A built-in web UI that gives real-time visibility into every invocation, runner, and workflow — no external tooling required.

```bash
pynenc --app=tasks.app monitor --host 0.0.0.0 --port 8000
```

<div class="pynmon-showcase" markdown="1">

<img src="/assets/img/pynmon_dashboard.png" alt="Pynmon dashboard showing application overview, invocation status, component architecture, and configuration" class="pynmon-screenshot lightbox-target">

### Execution Timeline

See what ran across every runner and worker, at every moment. Status transitions are color-coded — orange for pending, green for completed, blue for running — with connections between parent and child invocations.

<img src="/assets/img/pynenc_runners_timeline_detail.png" alt="Pynmon timeline comparing ThreadRunner, ProcessRunner, PersistentProcessRunner, and MultiThreadRunner" class="pynmon-screenshot lightbox-target">

### Family Tree

Navigate the full hierarchy of task calls as an interactive graph. Selecting a node cross-highlights it on the timeline, and vice versa.

<img src="/assets/img/pynmon_family_tree.png" alt="Pynmon family tree overlaid on timeline with cross-highlighting between graph and execution view" class="pynmon-screenshot lightbox-target">

### Log Explorer

Paste your log lines and the Log Explorer augments them with full context — parsing runner contexts, invocation IDs, and task references, resolving each to its detail page with a mini-timeline.

<img src="/assets/img/pynmon_log_explorer.png" alt="Pynmon Log Explorer parsing log lines with augmented context, mini-timeline, and links" class="pynmon-screenshot lightbox-target">

</div>

## Trigger system

Tasks can start automatically based on cron schedules, custom events, or the outcome
of other tasks. Triggers compose with AND/OR logic for complex automation flows.

```python
trigger = app.trigger.on_success(process_data).run(notify_admin)

scheduled = app.trigger.on_cron("*/30 * * * *").run(process_data, ...)
```

<div class="shroom-divider"><img src="/assets/img/pynenc_logo.png" alt="~"></div>

## Get involved <img class="shroom-sm" src="/assets/img/pynenc_logo.png" alt="">

- **Docs**: [docs.pynenc.org](https://docs.pynenc.org)
- **Source**: [github.com/pynenc/pynenc](https://github.com/pynenc/pynenc)
- **Issues & feedback**: [GitHub Issues](https://github.com/pynenc/pynenc/issues)
- **Discussions**: [GitHub Discussions](https://github.com/pynenc/pynenc/discussions)
- **Changelog**: [docs.pynenc.org/changelog](https://docs.pynenc.org/en/latest/changelog.html)

**v0.1.x** — All core features are implemented and running in production. The codebase is young; you may hit rough edges. Bug reports and contributions are very welcome<img class="shroom-dot" src="/assets/img/pynenc_logo.png" alt=""> MIT License<img class="shroom-dot" src="/assets/img/pynenc_logo.png" alt="">