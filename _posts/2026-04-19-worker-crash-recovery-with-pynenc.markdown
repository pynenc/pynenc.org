---
layout: post
title: "I Killed a Python Worker Mid-Task. Here's What Should Have Happened."
subtitle: "Crash recovery with heartbeat-based orphan detection in pynenc"
date: 2026-04-19 00:00:00 +0000
categories: [publications, recovery]
tags: [python, distributed-systems, reliability, pynenc]
share-img: /assets/img/posts/2026-04-19-worker-crash-recovery/wcr-monitoring.png
description: "I killed a Python worker mid-task with SIGKILL. The tasks vanished. Here is how pynenc detects dead runners via heartbeats and recovers orphaned tasks automatically."
---

I ran `kill -9` on a worker that was processing three tasks. They vanished. No error. No retry. I checked the queue: empty. I checked the results: nothing. The work was just gone.

This is not a bug. This is the default behavior of many Python task frameworks. A worker dies mid-execution, and whatever it was doing disappears.

So I built a framework where the system heals itself. Here is what that looks like.

## The problem nobody talks about

Here is what usually happens when a worker crashes in the middle of a task:

1. A task starts running on Worker-1.
2. Worker-1 gets OOM-killed (or crashes, or the host dies).
3. The task message was already acknowledged and removed from the queue.
4. The task is gone: no record, no detection, no recovery.

Typical workarounds teams build by hand:

- Late acknowledgement, which reduces task loss but increases duplicate execution risk.
- External monitoring, which detects failures but still requires manual re-queueing.
- Strict idempotency layers everywhere, which are useful but still need a recovery trigger.

These are not complete solutions. They are patches around a missing core capability.

## So I killed a worker. Here is what happened

I ran the same crash scenario with [pynenc](https://github.com/pynenc/pynenc): three tasks running, then `SIGKILL`, then a second worker.

```text
STEP 1: Starting Worker-1...
  Worker-1 started (PID 12345)

STEP 2: Submitting 3 long-running tasks...
  -> Submitted slow_task(0)
  -> Submitted slow_task(1)
  -> Submitted slow_task(2)

  Waiting for Worker-1 to pick up and start running tasks...

STEP 3: Simulating a worker crash!
  X Killing Worker-1 (PID 12345) with SIGKILL...
  X Worker-1 terminated (exit code -9)

  The in-progress task is now orphaned — no worker owns it.

STEP 4: Starting Worker-2 (the recovery worker)...
  Worker-2 started (PID 12346)

STEP 5: Waiting for recovery and task completion...
  OK slow_task completed: task_0_completed
  OK slow_task completed: task_1_completed
  OK slow_task completed: task_2_completed

  ALL 3 TASKS COMPLETED SUCCESSFULLY
  Tasks from the crashed worker were recovered automatically!
```

Worker-1 died mid-execution. Worker-2 detected the stale heartbeat, recovered orphaned tasks, and finished all three with zero manual intervention.

## Monitoring view

![Pynmon monitoring view during recovery demo](/assets/img/posts/2026-04-19-worker-crash-recovery/wcr-monitoring.png)

_Click to open the image at full size._

This is the same monitoring view used during the run. From here you can inspect the
timeline across runners, open each invocation detail, and follow the logs around state
changes to understand what happened step by step.

## How recovery works

Every runner sends periodic heartbeats. As long as heartbeats arrive, the runner is healthy.

When heartbeats stop:

1. The recovery service marks the runner as stale.
2. Orphaned running invocations are claimed safely.
3. Tasks are re-routed to the broker.
4. Healthy runners pick them up.

This is built in. No external watcher process required.

Recovery re-executes the full task, so designing tasks to be idempotent remains a best practice.

## The code

The task:

```python
# tasks.py (simplified — full version in the repo)
import time
from pynenc import Pynenc

app = Pynenc()

@app.task
def slow_task(task_num: int) -> str:
    slow_task.logger.info(f"[slow_task({task_num})] Starting — will run for 8 seconds")
    for second in range(8):
        time.sleep(1)
        slow_task.logger.info(f"[slow_task({task_num})] progress {second + 1}/8")
    return f"task_{task_num}_completed"
```

The demo configuration:

```toml
# pyproject.toml (key settings — full config in the repo)
[tool.pynenc]
app_id = "recovery_demo"
orchestrator_cls = "SQLiteOrchestrator"
broker_cls = "SQLiteBroker"
state_backend_cls = "SQLiteStateBackend"
runner_cls = "ThreadRunner"

# Fast recovery timeouts for demo purposes.
# Production systems use much higher values (defaults: 10 min heartbeat, 15 min recovery cron).
runner_considered_dead_after_minutes = 0.1          # 6 seconds — heartbeat expiry
recover_running_invocations_cron = "* * * * *"      # every minute (fastest cron resolution)
```

The full demo is in the public
[recovery_demo](https://github.com/pynenc/samples/tree/main/recovery_demo)
folder of the samples repository.

The entrypoint script is
[recovery_demo/sample.py](https://github.com/pynenc/samples/blob/main/recovery_demo/sample.py).

## Try it yourself

```bash
# Requires uv — install: https://docs.astral.sh/uv/getting-started/installation/
git clone https://github.com/pynenc/samples.git
cd samples/recovery_demo
uv sync
uv run python sample.py
```

No Docker. No Redis. No external services. One demo.

## What teams usually build by hand

| The problem | Typical approach | What pynenc does |
| --- | --- | --- |
| Worker dies mid-task | Lost task or duplicate retries | Automatic recovery via heartbeat detection |
| Detecting dead workers | External monitoring stack | Built-in runner heartbeat checks |
| Re-queuing orphaned tasks | Manual scripts and intervention | Automatic re-routing to broker |
| Recovery in clusters | Custom distributed locking | Atomic global recovery service |
| Understanding incidents | Log spelunking | Invocation state history and timeline views |

## What is next

Pynenc is open source and actively maintained:

- [pynenc](https://github.com/pynenc/pynenc) - core framework
- [samples](https://github.com/pynenc/samples) - runnable demos
- [docs](https://docs.pynenc.org) - full documentation

How does your team handle crashed workers today? Join the conversation in [GitHub Discussions](https://github.com/pynenc/pynenc/discussions).
