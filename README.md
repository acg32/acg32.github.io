# acg32.github.io

Static site generated with Jinja2 templates.

## Requirements
- Python 3.10+
- [uv](https://docs.astral.sh/uv/) installed

## Build
```bash
uv run build.py
```

- Output goes to `build/` and should be committed with your changes.
- Page content lives in `pages/` and extends `templates/base.html`.
- The shared navbar is defined once in `templates/navbar.html`; links are auto-built from the pages in `pages/` (everything except `index.html`), using the text before the dash in each page's `{% block title %}` as the label.
- Static assets live in `static/` and are copied to `build/static/`.

## Watch mode
Rebuild automatically when `pages/` or `static/` change:
```bash
uv run watch_build.py
```
