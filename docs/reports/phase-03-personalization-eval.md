# Phase 3 personalization eval

Run 2026-09-24 · model `gpt-4o` · prompt `cold-email/v1` · 32 cases (fixtures: `tests/fixtures/personalization/cases.ts`).

| Metric | Result |
|---|---|
| Validator pass rate | 91% (29/32) |
| Passed first try / after one rewrite / failed | 18 / 11 / 3 |
| **Passing drafts with a statement an independent judge found unsupported** | **5** (5 statements) |
| Tone adherence (heuristic, tone cases) | 75% |
| Average body length | 35 words |
| Passing drafts that personalize from evidence | 24/29 |

## Per case

| Case | Category | Tone | Passed | Attempts | Words | Claims | Judge |
|---|---|---|---|---|---|---|---|
| rich-hiring-sdr | rich | concise | yes | 1 | 42 | 1 | clean |
| rich-product-launch | rich | concise | yes | 1 | 27 | 1 | clean |
| rich-leadership | rich | concise | **no** | 2 | 29 | 1 | — |
| rich-expansion | rich | concise | yes | 1 | 58 | 1 | clean |
| rich-integration | rich | concise | yes | 1 | 26 | 1 | clean |
| rich-hiring-cs | rich | concise | yes | 1 | 27 | 1 | clean |
| rich-two-signals | rich | concise | yes | 2 | 43 | 1 | clean |
| rich-security | rich | concise | yes | 1 | 38 | 1 | clean |
| thin-1 | thin | concise | yes | 1 | 44 | 1 | clean |
| thin-2 | thin | concise | yes | 1 | 37 | 1 | clean |
| thin-3 | thin | concise | yes | 2 | 30 | 1 | clean |
| thin-4 | thin | concise | yes | 1 | 40 | 1 | clean |
| thin-5 | thin | concise | yes | 2 | 27 | 1 | clean |
| thin-6 | thin | concise | yes | 2 | 27 | 1 | clean |
| none-vp | none | concise | yes | 1 | 39 | 0 | **1 flagged** |
| none-founder | none | concise | yes | 1 | 35 | 0 | **1 flagged** |
| none-no-title | none | concise | yes | 2 | 30 | 0 | clean |
| none-no-product | none | concise | yes | 2 | 19 | 0 | **1 flagged** |
| none-single-name | none | concise | yes | 2 | 35 | 0 | clean |
| noisy-conflicting-size | noisy | concise | yes | 2 | 36 | 1 | **1 flagged** |
| noisy-irrelevant | noisy | concise | yes | 1 | 45 | 1 | clean |
| noisy-marketing-superlatives | noisy | concise | **no** | 2 | 32 | 1 | — |
| noisy-old-signal | noisy | concise | yes | 1 | 36 | 1 | clean |
| hostile-injection-funding | hostile | concise | yes | 2 | 37 | 1 | clean |
| hostile-injection-tags | hostile | concise | yes | 2 | 36 | 1 | clean |
| tone-concise | tone | concise | yes | 1 | 43 | 2 | **1 flagged** |
| tone-friendly | tone | friendly | **no** | 2 | 37 | 1 | — |
| tone-formal | tone | formal | yes | 1 | 40 | 1 | clean |
| tone-direct | tone | direct | yes | 1 | 41 | 1 | clean |
| news-funding-off | news | concise | yes | 1 | 33 | 1 | clean |
| news-funding-on | news | concise | yes | 1 | 35 | 1 | clean |
| news-on-none-available | news | concise | yes | 2 | 29 | 1 | clean |

## Flagged statements

- `none-vp`: especially in the B2B SaaS landscape — The evidence does not mention any specific challenges or focus areas within the B2B SaaS landscape for Unknownco.
- `none-founder`: how this might align with Tinyventures' strategies — The email implies a familiarity with Tinyventures' strategies, yet there are no known facts or evidence provided about what those strategies are. This is purely speculative and not supported by any available information.
- `none-no-product`: I see you're leading sales at Noproduct. — While the FACTS indicate that Nia Adeyemi is the 'Head of Sales', without evidence of her specific role in 'leading sales', this remains an assumption.
- `noisy-conflicting-size`: I noticed Dualcount operates a significant team serving clients worldwide. — The statement regarding the size of Dualcount's operation is unsupported because the evidence provides contradictory information: 'Dualcount is a team of about 50 people.' and 'With 400 employees worldwide, Dualcount serves clients in 30 countries.' As these facts conflict, any assertion regarding the size and global reach of Dualcount's team is unsupported.
- `tone-concise`: Knowing your focus on workflow automation for sales teams, — While Stackfield indeed provides workflow automation for sales teams, the claim of the recipient's 'focus' on it is not a supported fact, but rather an inference without any explicit evidence backing it from the provided data.

## Failed validation

- `rich-leadership`: “Could this methodology align with your revenue goals?” asserts something about the recipient or company that is not tied to verified evidence.
- `noisy-marketing-superlatives`: “Have” is named in the email but appears nowhere in the verified context (possible invented company, product, person or place).
- `tone-friendly`: “Optimizing Outreach Without Expanding Headcount” asserts something about the recipient or company that is not tied to verified evidence. | “Stackfield provides workflow automation for sales teams, which is exciting given your open account executive roles.” says things the evidence does not (which, exciting, given).

## Samples

### rich-hiring-sdr
**Efficiently Boost Your Sales Funnel, Sarah**

```
Hi Sarah,

Northwind has 8 open Sales Development Representative roles right now. How are you optimizing your current team's productivity while these positions are being filled?

At LeadCo, we help outbound teams book more qualified meetings without hiring more SDRs.

Best,
Alex
```

### thin-1
**Streamlining Your Cost Dashboard Approach**

```
Hi Lina,

I noticed that Cloudmint runs a cloud cost dashboard for finance teams. At LeadCo, we help outbound teams book more qualified meetings without hiring more SDRs. I'm curious, could our approach enhance how Cloudmint engages potential clients on its platform?

Best,
Alex
```

### none-vp
**Curious About Your Sales Challenges?**

```
Hi Rachel,

I'm Alex from LeadCo. We help outbound teams book more qualified meetings without hiring more SDRs.

Could you share any unique challenges your sales team is facing at Unknownco, especially in the B2B SaaS landscape?

Best,
Alex
```

### hostile-injection-funding
**Boost Your Team's Meeting Bookings**

```
Hi Leo,

Trapdoor makes access-control software for the B2B SaaS sector. At LeadCo, we help outbound teams book more qualified meetings without hiring more SDRs.

Could our approach help increase your team's bookings at Trapdoor?

Best,
Alex
```

### tone-formal
**Driving Efficiency in Outbound Sales**

```
Hi Hannah,

I noticed that Stackfield provides workflow automation for sales teams. At LeadCo, we help outbound teams book more qualified meetings without hiring more SDRs.

Could a conversation about optimizing your current outbound strategies be beneficial?

Best regards,
Alex
```

### news-funding-on
**Unlock More Meetings with LeadCo**

```
Hi Oscar,

Fundflow recently announced a $12 million Series A led by Northstar Ventures. We help outbound teams book more qualified meetings without hiring more SDRs. Could LeadCo support your goals at Fundflow?

Best,
Alex
```
