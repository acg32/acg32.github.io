#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "Jinja2>=3.1,<4",
# ]
# ///

"""Simple build script to render the static site into build/ using Jinja2 templates."""

from __future__ import annotations

import shutil
import re
from datetime import datetime
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape


ROOT = Path(__file__).parent
BUILD_DIR = ROOT / "build"
TEMPLATE_DIR = ROOT / "templates"
PAGES_DIR = ROOT / "pages"
STATIC_DIR = ROOT / "static"


def load_env() -> Environment:
    return Environment(
        loader=FileSystemLoader([str(TEMPLATE_DIR), str(PAGES_DIR)]),
        autoescape=select_autoescape(["html", "xml"]),
        trim_blocks=True,
        lstrip_blocks=True,
    )


def clean_build_directory() -> None:
    if BUILD_DIR.exists():
        shutil.rmtree(BUILD_DIR)
    BUILD_DIR.mkdir(parents=True, exist_ok=True)


def copy_static_files() -> None:
    if not STATIC_DIR.exists():
        return
    target_static_dir = BUILD_DIR / STATIC_DIR.name
    shutil.copytree(STATIC_DIR, target_static_dir, dirs_exist_ok=True)


def discover_pages() -> list[Path]:
    if not PAGES_DIR.exists():
        raise FileNotFoundError(f"Missing pages directory: {PAGES_DIR}")
    return sorted(PAGES_DIR.rglob("*.html"))

# Optional per-page icon mapping for the navbar labels.
NAV_ICONS: dict[str, str] = {
    "about": "👤",
    "projects": "🛠️",
    "fun": "🎮",
}


def page_slug(relative_path: Path) -> str:
    # Use path segments to create a slug; nested pages get slugs like "blog-post".
    slug_parts = list(relative_path.with_suffix("").parts)
    return "-".join(slug_parts)


def page_label(slug: str) -> str:
    return slug.replace("-", " ").title()


def extract_title_label(page_path: Path) -> str | None:
    """Best-effort extraction of the nav label from the page's title block."""
    content = page_path.read_text(encoding="utf-8")
    match = re.search(r"{%\s*block\s+title\s*%}(.*?){%\s*endblock\s*%}", content, re.DOTALL)
    if not match:
        return None
    title_content = match.group(1).strip()
    if not title_content:
        return None
    # Use everything before a dash if present (e.g., 'About - Site Name' -> 'About')
    return title_content.split("-", 1)[0].strip()


def render_pages(env: Environment) -> None:
    discovered = discover_pages()
    if not discovered:
        raise RuntimeError("No pages found to render.")

    nav_links = []
    for page in discovered:
        rel_path = page.relative_to(PAGES_DIR)
        slug = page_slug(rel_path)
        if rel_path.name == "index.html":
            continue  # keep index as entrypoint, don't add to nav
        label = extract_title_label(page) or page_label(slug)
        icon = NAV_ICONS.get(slug, "")
        if icon:
            label = f"{icon} {label}"
        nav_links.append(
            {
                "id": slug,
                "label": label,
                "href": rel_path.as_posix(),
            }
        )

    shared_context = {
        "nav_links": nav_links,
        "site_name": "Home",
        "brand_icon": "🏠",
        "home_href": "index.html",
        "static_css_path": f"{STATIC_DIR.name}/styles.css",
        "current_year": datetime.now().year,
    }

    for page in discovered:
        rel_path = page.relative_to(PAGES_DIR)
        slug = page_slug(rel_path)
        template = env.get_template(rel_path.as_posix())
        page_context = {**shared_context, "active_nav": slug}
        html = template.render(**page_context)
        output_path = BUILD_DIR / rel_path
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(html, encoding="utf-8")


def main() -> None:
    env = load_env()
    clean_build_directory()
    copy_static_files()
    render_pages(env)


if __name__ == "__main__":
    main()
