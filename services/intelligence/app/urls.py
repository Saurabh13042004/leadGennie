"""URL/domain helpers shared by sources, evidence and agents (neutral: no network, no IO)."""

from __future__ import annotations

from urllib.parse import urlparse

import tldextract

_extract = tldextract.TLDExtract(
    suffix_list_urls=(), cache_dir=None
)  # bundled snapshot, never hits the network


def registrable_domain(host_or_url: str) -> str:
    """`https://blog.acme.co.uk/x` -> `acme.co.uk` (bundled public-suffix snapshot; offline).

    Unknown suffixes (e.g. reserved test TLDs like `.example`) fall back to the last two labels."""
    ext = _extract(host_or_url)
    if ext.registered_domain:
        return ext.registered_domain
    host = (
        urlparse(host_or_url).hostname if "//" in host_or_url else host_or_url.split("/")[0]
    ) or host_or_url
    labels = host.lower().split(".")
    return ".".join(labels[-2:]) if len(labels) >= 2 else host.lower()


def same_site(a: str, b: str) -> bool:
    return registrable_domain(a) == registrable_domain(b)
