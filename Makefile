.DEFAULT_GOAL := help

.PHONY: help install serve serve-drafts build clean update check open

# ── Colours ───────────────────────────────────────────────────────────────────
BOLD   := \033[1m
RESET  := \033[0m
GREEN  := \033[32m
YELLOW := \033[33m

# ── Targets ───────────────────────────────────────────────────────────────────

help: ## Show this help message
	@echo ""
	@echo "  $(BOLD)pynenc.org$(RESET) — Jekyll site"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-16s$(RESET) %s\n", $$1, $$2}'
	@echo ""

install: ## Install all Ruby dependencies via Bundler
	bundle install

serve: ## Serve site locally with live-reload at http://localhost:4000
	bundle exec jekyll serve --livereload --open-url

serve-drafts: ## Serve site including draft posts
	bundle exec jekyll serve --livereload --drafts --open-url

build: ## Build the production site into ./_site
	JEKYLL_ENV=production bundle exec jekyll build

clean: ## Remove the generated _site directory and caches
	bundle exec jekyll clean

update: ## Update all gems to latest compatible versions
	bundle update

check: ## Run Jekyll doctor to diagnose configuration issues
	bundle exec jekyll doctor

open: ## Open the local development server URL in your browser
	@echo "$(YELLOW)Opening http://localhost:4000 …$(RESET)"
	open http://localhost:4000
