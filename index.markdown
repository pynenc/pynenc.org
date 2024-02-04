---
title: Pynenc
subtitle: A task management system for complex distributed orchestration
layout: page
callouts: home_callouts
show_sidebar: true
---

# Pynenc Project
![release date](https://img.shields.io/github/release-date-pre/pynenc/pynenc)
![pypi version](https://img.shields.io/pypi/v/pynenc)
![total commit activity](https://img.shields.io/github/commit-activity/t/pynenc/pynenc)
![pypi supported python](https://img.shields.io/pypi/pyversions/pynenc.svg)
![read the docs](https://img.shields.io/readthedocs/pynenc)
![GitHub issues](https://img.shields.io/github/issues/pynenc/pynenc)
![GitHub license](https://img.shields.io/github/license/pynenc/pynenc)
![GitHub last commit](https://img.shields.io/github/last-commit/pynenc/pynenc)
![GitHub contributors](https://img.shields.io/github/contributors/pynenc/pynenc)
![GitHub Repo stars](https://img.shields.io/github/stars/pynenc/pynenc)
![GitHub forks](https://img.shields.io/github/forks/pynenc/pynenc)

Pynenc is a powerful yet simple-to-use task management system designed for complex distributed orchestration in Python. It provides a streamlined way to manage and execute tasks across distributed systems, ensuring efficiency and scalability.

## Key Features
- **Easy to Use**: Set up and run distributed tasks with minimal configuration.
- **Scalable**: Efficiently manages tasks across multiple nodes in a distributed system.
- **Flexible**: Suitable for a wide range of distributed computing tasks.

## Quick Start Example

To get started with Pynenc, here's a simple example that demonstrates the creation of a distributed task for adding two numbers. Follow these steps to quickly set up a basic task and execute it.

1. **Define a Task**: Create a file named `tasks.py` and define a simple addition task:

   ```python
   from pynenc import Pynenc

   app = Pynenc()

   @app.task
   def add(x: int, y: int) -> int:
       add.logger.info(f"{add.task_id=} Adding {x} + {y}")
       return x + y
   ```

2. **Start Your Runner or Run Synchronously:**

   Before executing the task, decide if you want to run it asynchronously with a runner or synchronously for testing or development purposes.

   - **Asynchronously:**
     Start a runner in a separate terminal or script:
     ```bash
     pynenc --app=tasks.app runner start
     ```
     Check for the [basic_redis_example](https://github.com/pynenc/samples/tree/main/basic_redis_example)

   - **Synchronously:**
     For test or local demonstration, to try synchronous execution, you can set the environment variable `PYNENC__DEV_MODE_FORCE_SYNC_TASKS=True` to force tasks to run in the same thread.

3. **Execute the Task:**

   ```python
   result = add(1, 2).result
   print(result)  # This will output the result of 1 + 2
   ```

For a comprehensive overview of Pynenc's capabilities and more detailed examples, visit our [Usage Guide](https://docs.pynenc.org/en/latest/usage_guide/index.html) and the [samples library](https://github.com/pynenc/samples).

## Requirements

- **Redis**: As of now, Pynenc requires a Redis server to handle distributed task management. Ensure that you have Redis installed and running in your environment.

### Future Updates:
- Pynenc is being developed to support additional databases and message queues. This will expand its compatibility and usability in various distributed systems.

## Documentation

For full instructions and more detailed information about Pynenc, please see our [Documentation](https://docs.pynenc.org).

## Contact or Support

If you need help with Pynenc or want to discuss any aspects of its usage, feel free to reach out through the following channels:

- **[GitHub Issues](https://github.com/pynenc/pynenc/issues)**: For bug reports, feature requests, or other technical queries, please use our GitHub Issues page. You can create a new issue or contribute to existing discussions.

- **[GitHub Discussions](https://github.com/pynenc/pynenc/discussions)**: For more general questions, ideas exchange, or discussions about Pynenc, consider using GitHub Discussions on our repository. It's a great place to connect with other users and the development team.

Remember, your feedback and contributions are essential in helping Pynenc grow and improve!

## Contribute

Pynenc is an open-source project, and we welcome contributions of all kinds. Check out our [GitHub repository](https://github.com/pynenc/pynenc) to get involved!

## License

Pynenc is released under the [MIT License](https://github.com/pynenc/pynenc/blob/main/LICENSE).


