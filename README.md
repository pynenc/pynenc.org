# Pynenc.org Landing Page

## Overview
This repository contains the source code for the landing page of the `pynenc` project, hosted at [pynenc.org](https://pynenc.org). It is built with Jekyll, a static site generator, and deployed using GitHub Actions.

## Prerequisites
- Ruby (version as specified in `.ruby-version`)
- Bundler (`gem install bundler`)
- Jekyll (`gem install jekyll`)
- Git

## Setting Up for Local Development
1. **Clone the Repository**:  
   `git clone https://github.com/pynenc/pynenc.org.git`
2. **Navigate to the Directory**:  
   `cd pynenc.org`
3. **Install Dependencies**:  
   `bundle install`

## Running Locally
To run the website on your local machine:
1. **Start Jekyll Server**:  
   `bundle exec jekyll serve`
2. **Access Local Server**:  
   Open `http://localhost:4000` in your browser.

## Testing Your Changes
- Before committing your changes, run `bundle exec jekyll build` to build the site and check for any build errors.

## Cross-Platform Development
- If you are developing across different operating systems, run `bundle lock --add-platform x86_64-linux` to ensure compatibility.

## Updating Dependencies
- To update to the latest versions of dependencies, run `bundle update`.

## Making Changes
- **Content**: To add or edit content, modify the Markdown files in the `_posts` directory.
- **Styling**: Update the CSS files within the `assets/css` directory.
- **Configuration**: Adjust site-wide settings in `_config.yml`.

## Testing Your Changes
- Ensure your changes render correctly locally. 
- Run `bundle exec jekyll build` to build the site and check for any build errors.

## Deploying Changes
Changes pushed to the `main` branch are automatically deployed via GitHub Actions as specified in `.github/workflows/jekyll.yml`.

## Contributing
We welcome contributions to the `pynenc.org` landing page. Please read our contribution guidelines before submitting your pull request.

## License
This project is licensed under BSD 3-Clause License. See the [LICENSE](LICENSE) file for more details.
