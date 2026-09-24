"""Scoring guarantees (docs/intelligence-engine/scoring.md): deterministic, monotonic, exclusions dominate,
unknown never counts as met, and UNVERIFIED data has zero influence."""

from datetime import date, timedelta

import pytest
from app.contracts.common import SignalType
from app.contracts.icp import EmployeeRange, Exclusions, Icp, KeywordSignal, TitleCriterion, WeightedValue
from app.contracts.score import ScoreCompany, ScorePerson, ScoreRequest
from app.scoring.engine import score
from app.scoring.icp import Attributes, score_icp
from app.scoring.intent import EXPIRES_DAYS, SignalInput, score_intent
from hypothesis import given, settings
from hypothesis import strategies as st

AS_OF = date(2026, 9, 24)
ICP = Icp(
    industries=[WeightedValue(value="b2b_saas", weight=25)],
    employee_range=EmployeeRange(min=50, max=500, weight=20),
    geographies=[WeightedValue(value="IN", weight=15)],
    titles=[TitleCriterion(seniority=["vp", "head", "cxo"], function=["sales"], weight=25)],
    keyword_signals=[KeywordSignal(keyword="outbound", weight=15)],
)


def req(**company) -> ScoreRequest:  # type: ignore[no-untyped-def]
    return ScoreRequest(
        icp=ICP, company=ScoreCompany(**company), person=ScorePerson(title="VP Sales"), as_of=AS_OF
    )


def test_perfect_match_scores_100_and_explains_every_criterion() -> None:
    r = score(req(industry="B2B SaaS", country="India", employee_count=120, keywords_found=["outbound"])).icp
    assert r.score == 100 and r.confidence == 1.0
    assert {i.criterion: i.status for i in r.breakdown} == {
        "industry": "met",
        "employee_range": "met",
        "geography": "met",
        "title": "met",
        "keyword:outbound": "met",
    }
    assert sum(i.weight for i in r.breakdown) == pytest.approx(100, abs=0.1)


def test_unknown_is_not_met_and_lowers_confidence_but_never_inflates_the_score() -> None:
    r = score(req(industry="B2B SaaS")).icp  # size, country unknown; keyword absent
    by = {i.criterion: i for i in r.breakdown}
    assert by["employee_range"].status == "unknown" and by["employee_range"].points == 0
    assert by["geography"].status == "unknown"
    assert r.confidence < 1.0 and r.score < 60


def test_partial_matches() -> None:
    r = score(
        req(industry="Developer tools", employee_count=40, country="IN")
    ).icp  # adjacent industry; slightly under range
    by = {i.criterion: i for i in r.breakdown}
    assert by["industry"].status == "partial" and by["employee_range"].status == "partial"
    assert 0 < by["industry"].points < by["industry"].weight


def test_exclusions_dominate_and_cap_the_score() -> None:
    icp = ICP.model_copy(update={"exclusions": Exclusions(domains=["competitor.com"], titles=["intern"])})
    good = dict(industry="B2B SaaS", country="IN", employee_count=120, keywords_found=["outbound"])
    r = score(
        ScoreRequest(
            icp=icp,
            company=ScoreCompany(domain="app.competitor.com", **good),
            person=ScorePerson(title="VP Sales"),
            as_of=AS_OF,
        )
    )
    assert r.icp.score <= 10 and not r.qualified and any(i.criterion == "exclusion" for i in r.icp.breakdown)
    r2 = score(
        ScoreRequest(
            icp=icp, company=ScoreCompany(**good), person=ScorePerson(title="Sales Intern"), as_of=AS_OF
        )
    )
    assert r2.icp.score <= 10


def test_title_needs_a_person_and_normalizes_titles() -> None:
    no_person = score(ScoreRequest(icp=ICP, company=ScoreCompany(industry="SaaS"), as_of=AS_OF)).icp
    assert next(i for i in no_person.breakdown if i.criterion == "title").status == "unknown"
    ic = score(
        ScoreRequest(
            icp=ICP,
            company=ScoreCompany(industry="SaaS"),
            person=ScorePerson(title="Software Engineer"),
            as_of=AS_OF,
        )
    ).icp
    assert next(i for i in ic.breakdown if i.criterion == "title").status == "not_met"


def test_empty_icp_scores_zero_with_zero_confidence() -> None:
    r = score(ScoreRequest(icp=Icp(), company=ScoreCompany(industry="SaaS"), as_of=AS_OF))
    assert r.icp.score == 0 and r.icp.confidence == 0 and not r.qualified


def test_evidence_ids_link_only_matched_criteria() -> None:
    r = score(
        ScoreRequest(
            icp=ICP,
            company=ScoreCompany(industry="SaaS", employee_count=10),
            evidence={"industry": ["ev_1"], "employee_count": ["ev_2"]},
            as_of=AS_OF,
        )
    ).icp
    by = {i.criterion: i for i in r.breakdown}
    assert (
        by["industry"].evidence_ids == ["ev_1"] and by["employee_range"].evidence_ids == []
    )  # not_met -> no evidence claimed


# ---- intent ---------------------------------------------------------------------------------------------


def sig(
    t: SignalType, days_ago: int, conf: float = 0.9, verified: bool = True, id: str | None = None
) -> SignalInput:
    return SignalInput(t, conf, AS_OF - timedelta(days=days_ago), verified, id)


def test_unverified_signals_have_zero_influence() -> None:
    base = score_intent([sig(SignalType.HIRING, 5)], AS_OF)
    with_unverified = score_intent(
        [sig(SignalType.HIRING, 5), sig(SignalType.FUNDING, 1, verified=False)], AS_OF
    )
    assert base == with_unverified


def test_recency_decays_and_expires() -> None:
    fresh, old = (
        score_intent([sig(SignalType.HIRING, 1)], AS_OF),
        score_intent([sig(SignalType.HIRING, 90)], AS_OF),
    )
    assert fresh.score > old.score > 0
    assert score_intent([sig(SignalType.HIRING, EXPIRES_DAYS + 1)], AS_OF).score == 0
    undated = score_intent([SignalInput(SignalType.HIRING, 0.9, None, True)], AS_OF)
    assert 0 < undated.score < fresh.score  # undated is treated as old, never fresh


def test_diminishing_returns_within_a_type_and_cap_at_100() -> None:
    one = score_intent([sig(SignalType.HIRING, 1, id="a")], AS_OF).score
    three = score_intent([sig(SignalType.HIRING, 1, id=str(i)) for i in range(3)], AS_OF).score
    assert one < three < 3 * one
    assert score_intent([sig(t, 0) for t in SignalType for _ in range(6)], AS_OF).score == 100


# ---- properties -----------------------------------------------------------------------------------------

industries = st.sampled_from([None, "B2B SaaS", "Fintech", "Developer tools", "Retail store", "Media"])
countries = st.sampled_from([None, "India", "US", "Germany", "Bengaluru", "Atlantis"])
counts = st.one_of(st.none(), st.integers(0, 100_000))
titles = st.sampled_from([None, "VP Sales", "CTO", "Software Engineer", "Head of Growth", "Intern"])


@settings(max_examples=150, deadline=None)
@given(industries, countries, counts, titles)
def test_score_is_deterministic_and_bounded(industry, country, employees, title) -> None:  # type: ignore[no-untyped-def]
    r = ScoreRequest(
        icp=ICP,
        company=ScoreCompany(industry=industry, country=country, employee_count=employees),
        person=ScorePerson(title=title) if title else None,
        as_of=AS_OF,
    )
    a, b = score(r), score(r)
    assert a == b and 0 <= a.icp.score <= 100 and 0 <= a.icp.confidence <= 1 and 0 <= a.intent.score <= 100


@settings(max_examples=100, deadline=None)
@given(industries, countries, counts)
def test_adding_a_matching_attribute_never_lowers_the_score(industry, country, employees) -> None:  # type: ignore[no-untyped-def]
    base = ScoreCompany(industry=industry, country=country, employee_count=employees)
    better = ScoreCompany(industry="B2B SaaS", country=country, employee_count=employees)
    person = ScorePerson(title="VP Sales")
    s0 = score(ScoreRequest(icp=ICP, company=base, person=person, as_of=AS_OF)).icp.score
    s1 = score(ScoreRequest(icp=ICP, company=better, person=person, as_of=AS_OF)).icp.score
    if industry in (None, "B2B SaaS", "Fintech", "Developer tools", "Retail store", "Media"):
        assert s1 >= s0


@settings(max_examples=100, deadline=None)
@given(
    st.lists(
        st.tuples(
            st.sampled_from(list(SignalType)), st.floats(0.05, 1.0), st.integers(0, 200), st.booleans()
        ),
        max_size=8,
    ),
    st.sampled_from(list(SignalType)),
    st.floats(0.05, 1.0),
    st.integers(0, 60),
)
def test_adding_a_verified_signal_never_lowers_intent_and_unverified_never_changes_it(
    existing, t, conf, age
) -> None:  # type: ignore[no-untyped-def]
    base = [sig(st_, days, c, v, id=f"s{i}") for i, (st_, c, days, v) in enumerate(existing)]
    s0 = score_intent(base, AS_OF).score
    assert score_intent([*base, sig(t, age, conf, True, id="new")], AS_OF).score >= s0
    assert score_intent([*base, sig(t, age, conf, False, id="new")], AS_OF).score == s0


def test_qualified_requires_threshold_and_no_exclusion() -> None:
    hi = score(req(industry="B2B SaaS", country="India", employee_count=120, keywords_found=["outbound"]))
    assert hi.qualified
    lo = score(req(industry="Retail store", country="US", employee_count=5))
    assert not lo.qualified


def test_attributes_dataclass_is_frozen() -> None:
    a = Attributes(industry="fintech")
    with pytest.raises(AttributeError):
        a.industry = "x"  # type: ignore[misc]
    assert score_icp(ICP, a).score >= 0
