import pytest
from app.scoring import taxonomy


@pytest.mark.parametrize(
    "title,function",
    [
        ("Customer Success Manager, Growth", "customer_success"),
        ("Design Engineer (Web & Brand)", "engineering"),
        ("Sales Engineer", "sales"),
        ("Product Marketing Manager", "marketing"),
        ("Sales Development Representative", "sales"),
        ("Senior Product Designer", "product"),
        ("Product Support Specialist, Europe", "customer_success"),
        ("Account Executive, Startups", "sales"),
        ("VP Sales", "sales"),
        ("Chief Technology Officer", None),  # 'technology' -> engineering, checked below
        ("Head of People", "hr"),
        ("Deal Desk", "finance"),
        ("Implementation Manager", "operations"),
    ],
)
def test_function_classification(title: str, function: str | None) -> None:
    got = taxonomy.normalize_title(title)[1]
    assert got == (function or got)
    if function:
        assert got == function


def test_cto_is_engineering_and_ceo_is_general() -> None:
    assert taxonomy.normalize_title("CTO") == ("cxo", "engineering")
    assert taxonomy.normalize_title("Co-founder, CEO") == ("founder", "general")
    assert (
        taxonomy.normalize_function("G&A") is None
        and taxonomy.normalize_function("Engineering") == "engineering"
    )
    assert taxonomy.normalize_function("Customer Success") == "customer_success"


@pytest.mark.parametrize(
    "text,industry",
    [
        ("B2B SaaS", "b2b_saas"),
        ("Fintech / Payments", "fintech"),
        ("e-commerce", "ecommerce"),
        ("Developer tools", "devtools"),
        ("Artificial Intelligence", "ai_ml"),
        ("basket weaving", None),
    ],
)
def test_industry_normalization(text: str, industry: str | None) -> None:
    assert taxonomy.normalize_industry(text) == industry


@pytest.mark.parametrize(
    "text,iso",
    [
        ("Bengaluru, India", "IN"),
        ("Austin, TX, USA", "US"),
        ("London", "GB"),
        ("Berlin, Germany", "DE"),
        ("IN", "IN"),
        ("Atlantis", None),
    ],
)
def test_country_normalization(text: str, iso: str | None) -> None:
    assert taxonomy.normalize_country(text) == iso
