from app.sources.html import parse_html

from tests.helpers import fixture


def test_home_page_cleaning_links_and_metadata() -> None:
    page = parse_html(fixture("acme_home.html"), "https://acme.example/")
    assert page.title == "Acme — outbound platform"
    assert "window.track" not in page.text and "Privacy" not in page.text  # scripts + footer removed
    assert "B2B SaaS platform for outbound sales teams" in page.text
    assert (
        "https://acme.example/careers" in page.links and "https://acme.example/about" in page.links
    )  # nav links kept
    assert page.metadata["jsonld"][0]["numberOfEmployees"]["value"] == 120
    assert page.metadata["feeds"] == ["https://acme.example/blog/feed.xml"]


def test_published_date_from_meta_and_time_tag() -> None:
    page = parse_html(fixture("acme_news.html"), "https://acme.example/news/1")
    assert page.published_at is not None and page.published_at.date().isoformat() == "2026-09-12"


def test_js_shell_yields_almost_no_text_but_does_not_crash() -> None:
    page = parse_html(fixture("js_shell.html"), "https://spa.example/")
    assert page.text.strip() == "" and page.title == "App"


def test_malformed_html_is_tolerated() -> None:
    page = parse_html("<html><body><p>Unclosed <b>bold <a href='/x'>link</body>", "https://x.example/")
    assert "Unclosed" in page.text and page.links == ["https://x.example/x"]
