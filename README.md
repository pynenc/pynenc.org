# pynenc.org

Source for the [pynenc.org](https://pynenc.org) landing page — built with [Jekyll](https://jekyllrb.com) and the [Beautiful Jekyll](https://beautifuljekyll.com) theme, deployed automatically to GitHub Pages on every push to `main`.

## Prerequisites

- Ruby ≥ 3.2 (`brew install ruby` on macOS, or use `rbenv`/`asdf`)
- Bundler (`gem install bundler`)

## Quick start

```sh
make install   # bundle install
make serve     # jekyll serve --livereload → opens http://localhost:4000
```

## Makefile targets

| Target              | Description                                        |
| ------------------- | -------------------------------------------------- |
| `make install`      | Install Ruby dependencies                          |
| `make serve`        | Serve locally with live-reload (opens browser)     |
| `make serve-drafts` | Serve including unpublished draft posts            |
| `make build`        | Production build into `_site/`                     |
| `make clean`        | Remove `_site/` and Jekyll caches                  |
| `make update`       | Update all gems to latest compatible versions      |
| `make check`        | Run `jekyll doctor` to diagnose config issues      |
| `make open`         | Open `http://localhost:4000` in your browser       |

## Project layout

```
_config.yml          # Site-wide settings (theme, nav, colours, social links)
index.markdown       # Main landing page content
about.markdown       # About page
_posts/              # Blog posts (YYYY-MM-DD-title.markdown)
assets/img/          # Images (logo, avatar)
.github/workflows/   # GitHub Actions CI/CD
Makefile             # Local development shortcuts
Gemfile              # Ruby dependencies (github-pages gem)
```

## Making changes

- **Landing page** — edit [`index.markdown`](index.markdown)
- **Site settings** (title, colours, nav, social links) — edit [`_config.yml`](_config.yml)
- **About page** — edit [`about.markdown`](about.markdown)
- **Blog posts** — add `_posts/YYYY-MM-DD-your-title.markdown`

## Deployment

Every push to `main` triggers the [GitHub Actions workflow](.github/workflows/jekyll.yml), which builds and deploys to GitHub Pages automatically.

Test a production build locally before pushing:

```sh
make build
```

## Updating dependencies

```sh
make update   # bundle update — upgrades github-pages and all gems
```

After updating, run `make build` to confirm nothing is broken, then commit the updated `Gemfile.lock`.

## License

BSD 3-Clause — see [LICENSE](LICENSE).
