---
layout: post
title: "Why pynenc uses an invocation state machine"
subtitle: "Recovery is clearer when it is a state, not a flag."
date: 2026-05-09 00:00:00 +0000
categories: [publications, architecture]
tags: [python, distributed-systems, state-machine, recovery, pynenc]
author: Jose Diaz
share-img: /assets/img/shared/invocation-state-machine-2026-05-09.svg
description: "Why pynenc models task invocations as a state machine, and how explicit recovery states keep worker crash recovery portable."
keywords: "python task state machine, distributed task recovery, worker crash recovery, task queue lifecycle, pynenc invocation status, finite state machine"
---

Pynenc models every task invocation as a finite-state machine. The file
[`pynenc/invocation/status.py`](https://github.com/pynenc/pynenc/blob/main/pynenc/invocation/status.py)
declares the invocation states, the allowed transitions between them, ownership
rules, and dedicated recovery states.

That is more structure than a simple `pending/running/done` task table. The
extra machinery is there for a concrete reason: pynenc needs the same task
lifecycle to work across in-memory tests, SQLite, Redis, MongoDB, and other
backends without making correctness depend on one storage engine's locking
model.

The diagram below is a dated copy of the state graph generated from the
implementation. The current generated SVG in the core repository lives at
[`docs/_static/invocation_state_machine.svg`](https://github.com/pynenc/pynenc/blob/main/docs/_static/invocation_state_machine.svg).

![Pynenc invocation status state machine](/assets/img/shared/invocation-state-machine-2026-05-09.svg)

With pynenc 0.2.3 installed, the diagram can be regenerated from the live code:

```bash
pynenc status render --format svg
```

This article uses that graph to explain two design choices:

1. What does the state machine buy us?
2. Why do `PENDING` and `PENDING_RECOVERY` exist as separate states instead of
   one `PENDING` status with a `recovering` flag?

The short answer: the state machine is a feature that follows from pynenc's
backend portability goal. The recovery states are where that design becomes
visible.

## The states, briefly

The status graph starts when a task call is registered, moves through runner
ownership while it is being executed, and ends in a final status such as
`SUCCESS`, `FAILED`, or `CONCURRENCY_CONTROLLED_FINAL`.

The main flow is familiar:

```text
START
  -> REGISTERED
       -> PENDING
            -> RUNNING
                 -> SUCCESS
                 -> FAILED
                 -> RETRY -> PENDING
```

The rest of the graph handles real worker-pool behavior:

```text
REGISTERED
  -> CONCURRENCY_CONTROLLED -> REROUTED
  -> CONCURRENCY_CONTROLLED_FINAL

PENDING
  -> PENDING_RECOVERY -> REROUTED
  -> REROUTED
  -> KILLED -> REROUTED

RUNNING
  -> PAUSED -> RESUMED
  -> RUNNING_RECOVERY -> REROUTED
  -> KILLED -> REROUTED

RESUMED
  -> PAUSED
  -> RETRY -> PENDING
  -> SUCCESS
  -> FAILED
```

Some names look redundant at first: `REROUTED`, `PENDING_RECOVERY`, `RUNNING_RECOVERY`, and the two concurrency-control states. They exist because
they have different transition or ownership rules. In pynenc, a different rule
gets a different state.

`CONCURRENCY_CONTROLLED` is temporary: the invocation was blocked by a concurrency rule and will be rerouted to try again. `CONCURRENCY_CONTROLLED_FINAL`
is terminal: the invocation was blocked and configured to not retry — its caller receives a final status with no result stored in the state backend.

## Why the state machine exists

Pynenc is designed to run the same task code on different backends:

- in-memory backends for unit tests,
- SQLite for single-host services and local runs,
- Redis or MongoDB plugins,
- RabbitMQ on the broker side,
- and future plugin backends.

A framework tied to one database can design around that database's strongest
primitive. A backend-agnostic framework has to assume less. Some backends have
transactions. Some have atomic updates for specific data shapes. Some are
useful mainly for local development.

Pynenc cannot make correctness depend on every backend exposing the same lock or
transaction model. Instead, it pushes the lifecycle rules into the framework:
the legal states, ownership requirements, and recovery transitions are declared
in one table.

That table is `_CONFIG` in
[`status.py`](https://github.com/pynenc/pynenc/blob/main/pynenc/invocation/status.py).
Every state change goes through `validate_transition`, `validate_ownership`, and
`compute_new_owner`. The backend stores status records; the framework decides
whether the next status is allowed.

That is the tradeoff. The backend contract stays small, and the lifecycle stays
consistent while the storage implementation changes underneath it.

## Why `PENDING_RECOVERY` is a state

Consider one invocation:

1. A runner picks it up from the broker. The status moves to `PENDING`, and the
   runner becomes the owner.
2. The runner either starts executing it, moving it to `RUNNING`, or disappears
   before execution starts.

In the second case, the invocation is stuck in `PENDING` with an owner that no
longer exists. Other runners are not allowed to touch it, because `PENDING`
requires ownership validation.

One possible design is a flag on the status record:

```text
status = PENDING
recovering = true
```

Pynenc does not do that. It uses a separate state:

```python
InvocationStatus.PENDING_RECOVERY: StatusDefinition(
    allowed_transitions=frozenset({InvocationStatus.REROUTED}),
    releases_ownership=True,
    overrides_ownership=True,
)
```

Those three properties are the point.

`overrides_ownership=True` means recovery is the only path where a non-owner can
touch the invocation. If a runner breaks ownership, the status history says so.

`allowed_transitions={REROUTED}` means recovery does not jump straight to
execution. The invocation re-enters the normal queue path, then a healthy runner
can pick it up.

`releases_ownership=True` removes the dead owner from the record, making the
invocation claimable again.

The same pattern exists for `RUNNING_RECOVERY`, which handles invocations whose
owner disappeared during execution.

## Why not a flag?

A flag looks smaller, but it spreads the rule across the system.

Every code path that reads `PENDING` would also need to ask whether recovery is
active. Every backend would need to serialize the flag. Every test around
`PENDING` would need the extra matrix case. The lifecycle would be partly in the
status and partly in a boolean field.

As a state, recovery is handled by the same mechanism as everything else. The
allowed-transition table answers the question in one place.

It also gives operators a better audit trail. This sequence tells a clear story:

```text
REGISTERED
-> PENDING(owner=A)
-> PENDING_RECOVERY(no owner)
-> REROUTED
-> PENDING(owner=B)
-> RUNNING(owner=B)
-> SUCCESS
```

The history says that runner `A` stopped responding, recovery released the
owner, and runner `B` completed the work. That is much easier to inspect than a
status row where a boolean quietly changed at some point.

## What the state machine costs

This is not free.

There is more code than a flag: one `StatusDefinition` per status, transition
sets, ownership rules, and tests around invalid state changes. There is also
more terminology for users to learn. The first time somebody sees
`RUNNING_RECOVERY` in a timeline, they need to know that it means a runner died
and another service noticed.

The benefit is specific: the correctness of the task lifecycle does not depend
on every backend exposing the same primitives. The framework has one source of
truth for transitions, and the documentation diagram is generated from that
source.

## Takeaways

Strict state machines are useful when a system needs to run on more than one
backend. They keep the backend interface small and put lifecycle rules in a
place that can be tested directly.

Special cases deserve first-class states when they have different rules.
`PENDING_RECOVERY` is not just `PENDING` with another field. It can override
ownership, release ownership, and only transition back through `REROUTED`. That
is a real state.

The audit trail is part of the API. Every recovery state in the timeline is one
more fact an operator can inspect when something goes wrong.

Pynenc is on PyPI as [`pynenc`](https://pypi.org/project/pynenc/), and the
source is at [github.com/pynenc/pynenc](https://github.com/pynenc/pynenc).
The status configuration discussed here lives in
[`pynenc/invocation/status.py`](https://github.com/pynenc/pynenc/blob/main/pynenc/invocation/status.py).
