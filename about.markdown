---
layout: page
title: About
subtitle: The story behind Pynenc
permalink: /about/
---

## What is Pynenc?

**Pynenc** (pronounced *pie-nenk*) is an open-source Python task management system built for complex distributed orchestration. It was created to solve the hard problems that simpler task queues leave unsolved: dependency resolution, concurrency control, deterministic workflows, and real-time observability — all with a clean Pythonic API.

The name is a nod to the Peruvian deity **Pynenc** — much like a divine order that governs chaos, the library governs distributed task execution.

## Why Pynenc?

Distributed task systems like Celery excel at simple fire-and-forget jobs. Pynenc goes further:

- **Automatic deadlock prevention** — tasks that depend on each other are paused and resumed automatically
- **Concurrency modes** — four levels of deduplication (`DISABLED`, `TASK`, `ARGUMENTS`, `KEYS`) so you never run duplicate work
- **Invocation state machine** — every task call has an auditable lifecycle with ownership tracking and automatic recovery
- **Deterministic workflows** — multi-step workflows replay from stored results and resume from exact failure points
- **Declarative triggers** — cron, event-driven, and task-status conditions composable with AND/OR logic
- **First-class observability** — built-in web monitoring (Pynmon) with SVG timelines, family trees, and an interactive log explorer

## Philosophy

Pynenc is designed around a few core ideas:

1. **Plugin over monolith** — the core is infrastructure-agnostic; production backends (Redis, MongoDB, RabbitMQ) are separate installable packages that extend the system transparently
2. **Type safety everywhere** — status transitions, configuration, and builder methods are fully typed and validated
3. **Zero magic** — orchestration behaviour is explicit and predictable; no hidden retries or silent failures

## Project

Pynenc is developed in the open on GitHub. Contributions, bug reports, and feature requests are welcome.

- **Source code**: [github.com/pynenc/pynenc](https://github.com/pynenc/pynenc)
- **Documentation**: [docs.pynenc.org](https://docs.pynenc.org)
- **PyPI**: [pypi.org/project/pynenc](https://pypi.org/project/pynenc/)
- **Issues & discussions**: [GitHub Issues](https://github.com/pynenc/pynenc/issues) / [GitHub Discussions](https://github.com/pynenc/pynenc/discussions)

## License

Pynenc is released under the [MIT License](https://github.com/pynenc/pynenc/blob/main/LICENSE).

