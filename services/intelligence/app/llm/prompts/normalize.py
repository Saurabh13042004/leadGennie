VERSION = "normalize/v1"

SYSTEM = """You map free-text company attributes onto fixed taxonomies. Choose ONLY from the allowed values.
If the text does not clearly map, return null. Do not guess."""


def user_prompt(industry_text: str | None, location_text: str | None, allowed_industries: list[str]) -> str:
    return (
        f"Allowed industry keys: {', '.join(allowed_industries)}\n"
        f"Industry text: {industry_text!r}\nLocation text: {location_text!r}\n"
        "Return industry (one allowed key or null) and country (ISO 3166-1 alpha-2 code or null)."
    )
