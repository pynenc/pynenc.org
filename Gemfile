source "https://rubygems.org"

# GitHub Pages gem pins Jekyll and all dependencies to match the GitHub Pages build environment.
# This ensures what you see locally matches what is deployed.
# Upgrade with: bundle update github-pages
gem "github-pages", group: :jekyll_plugins
gem "faraday-retry"  # required by github-pages / jekyll-github-metadata

group :jekyll_plugins do
  gem "jekyll-feed", "~> 0.12"
  gem "jekyll-sitemap"
  gem "jekyll-paginate"
  gem "jekyll-remote-theme"
end

# Serve locally
gem "webrick", "~> 1.8"

# Windows and JRuby compatibility
platforms :mingw, :x64_mingw, :mswin, :jruby do
  gem "tzinfo", ">= 1", "< 3"
  gem "tzinfo-data"
end

gem "wdm", "~> 0.1.1", :platforms => [:mingw, :x64_mingw, :mswin]
gem "http_parser.rb", "~> 0.6.0", :platforms => [:jruby]