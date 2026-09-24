from __future__ import annotations

from app.contracts.score import ScoreCompany, ScoreData, ScorePerson, ScoreRequest
from app.scoring import taxonomy
from app.scoring.icp import SCORING_VERSION, Attributes, score_icp
from app.scoring.intent import SignalInput, score_intent


def attributes_from_request(
    company: ScoreCompany, person: ScorePerson | None, evidence: dict[str, list[str]]
) -> Attributes:
    """Rule-based normalization only (this path has no LLM). Runs use the Qualification agent, which
    may resolve what the rules can't and then calls `score_icp` directly with the normalized values."""
    seniority, function = taxonomy.normalize_title(person.title if person else None)
    domain = company.domain.strip().lower() if company.domain else None
    return Attributes(
        industry=taxonomy.normalize_industry(company.industry),
        country=taxonomy.normalize_country(company.country),
        employee_count=company.employee_count,
        seniority=seniority,
        function=function,
        domain=domain,
        title_text=person.title if person else None,
        has_person=person is not None and bool(person.title),
        keywords_found=frozenset(k.strip().lower() for k in company.keywords_found if k.strip()),
        evidence=evidence,
    )


def score(request: ScoreRequest) -> ScoreData:
    attrs = attributes_from_request(request.company, request.person, request.evidence)
    icp = score_icp(request.icp, attrs)
    intent = score_intent(
        [SignalInput(s.type, s.confidence, s.detected_at, s.verified, s.id) for s in request.signals],
        request.as_of,
    )
    excluded = any(i.criterion == "exclusion" for i in icp.breakdown)
    return ScoreData(
        scoring_version=SCORING_VERSION,
        icp=icp,
        intent=intent,
        qualified=(not excluded) and icp.score >= request.icp.min_score_to_qualify,
    )
