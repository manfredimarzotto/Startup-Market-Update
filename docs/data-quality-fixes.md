# Radar Data Quality Fixes — Implementation Guide

Run these in Claude Code in order. Check results after each step before moving on.

---

## Fix 1: Recalibrate Scores

The current scores cluster in the 65–81 range, making everything look equally interesting.
The scoring model (docs/scoring-model.md) says a company's score should honestly reflect
observable activity. A seed company with €270K across angel closes and 1 source should NOT
score 76 — that's nearly the same as a €30M Series A with 4 sources.

### Problem diagnosis

The likely issue is one of:
a) The scoring function doesn't properly weight Source Density (most companies show 1 source)
b) The decay function isn't applied, so old events score as if they just happened
c) Factor scores are inflated by generous base points
d) There's a floor or minimum score that prevents companies from scoring below ~65

### Claude Code prompt

```
Read docs/scoring-model.md for the full scoring specification.

Audit the current scoring logic. Find where scores are calculated and check:

1. Are all four factors (Events, Capital, Momentum, Sources) actually computed
   separately, each 0-25? Or is there a simpler heuristic being used?

2. Is Source Density actually counting independent sources? Right now most
   companies show "1 source" but have Source scores of 4-26 in the breakdown,
   which is a visible contradiction. Source Density should be: number of
   independent sources × source quality weight, capped at 25. A company with
   1 source should have a Source score of 1-5, not 20+.

3. Is the 45-day decay multiplier applied? Events older than 45 days should
   contribute 0. Events 15-30 days old should be multiplied by 0.40.

4. Is Capital Activity actually 0 when there's no recent funding round?
   Companies like Cosuno (growth signal, no new round) should have Capital = 0.

5. What does the actual score distribution look like? Run the scoring across
   all companies and show me: min, max, mean, median, and the 10th/25th/75th/90th
   percentiles. A healthy distribution for 107 companies should look roughly like:
   - Top 5% (5 companies): 75-100
   - Top 20% (21 companies): 60-75
   - Median (~54th company): 40-55
   - Bottom 30% (32 companies): 0-30

Fix the scoring logic to match the spec. Then re-run scores for all companies
and show me the new distribution.
```

### What "done" looks like

- Score range spans from single digits to 80s, not 65-81
- Companies with 1 source have Source scores of 1-5
- Companies with no funding have Capital = 0
- The distribution looks believable: most companies in the 30-60 range, a few standouts above 75

---

## Fix 2: Rewrite Summaries to Factual Compression

Current summaries read like AI-generated investment memos:
"signals strong institutional validation for European defense tech at a critical moment
when NATO members are rapidly..."

Target style is evidence synthesis:
"€30M Series A closed · defence procurement subsystems · 4 source confirmations ·
NATO 3.5% GDP mandate in effect."

### Claude Code prompt

```
The company summaries in the radar need to be rewritten from narrative prose
to factual compression style.

Current style (BAD):
"Photoncycle's €15M Series A validates the seasonal hydrogen storage market
at a critical inflection point where Europe's renewable overcapacity (driven
by aggressive wind/solar buildouts) is creating immediate demand..."

Target style (GOOD):
"€15M Series A · seasonal hydrogen storage · NL + DK expansion · 3 sources ·
EU grid spend forecast +€4.2B."

Rules for the new summary style:
1. Lead with the hard fact (round size, or key event if no funding)
2. Use middot separators (·) between facts, not sentences
3. Include source count as a fact
4. Include one concrete market/policy datapoint if available
5. Maximum 120 characters. Truncate ruthlessly.
6. NO interpretation words: "validates", "signals", "positions",
   "captures", "at a critical moment", "inflection point"
7. NO hedging: "meaningful", "substantial", "significant"
8. NO narrative framing: "at a moment when", "making this", "positioning the"

Find where summaries are generated (likely in the Claude/LLM prompt that
processes RSS signals). Update the prompt template to produce this style.

If summaries are currently stored as static text, rewrite all of them
to match the target style.

Also update the system prompt or template to include these few-shot examples:

EXAMPLES OF GOOD SUMMARIES:
- "€30M Series A closed · defence procurement subsystems · 4 sources · NATO 3.5% GDP mandate in effect."
- "$9M round · AI parts procurement for MRO · 2 sources · investor undisclosed."
- "€270K across 3 angel closes · AI therapy localisation · 2 sources · no lead identified."
- "No new round · hiring surge +40% QoQ · 3 sources · German construction digitisation mandate Q3 2026."
- "$200M valuation · founder-first accelerator · 2 sources · neobank ecosystem consolidation."

EXAMPLES OF BAD SUMMARIES:
- "signals strong investor conviction in AI-driven supply chain modernization at a critical inflection point"
- "validates the seasonal hydrogen storage market at a critical inflection point where Europe's renewable overcapacity"
- "captures meaningful angel momentum for a culturally-adapted AI therapy model at a moment when mental health AI"
```

### What "done" looks like

- Every summary is under 120 characters
- Every summary starts with a hard fact, not an interpretation
- No company summary contains "signals", "validates", "positions", "critical moment", or "inflection point"
- Reading 10 summaries in sequence feels like scanning a Bloomberg terminal, not reading an analyst note

---

## Fix 3: Multiple Triggers per Company in "Why Surfaced"

Currently most companies show only 1 trigger in the drawer. The spec calls for 3-5
concrete triggers with different types and timestamps. This is what converts the
ranking from a black box into auditable decision support.

### Claude Code prompt

```
The "Why surfaced" drawer currently shows only 1 trigger per company.
Update the data pipeline to generate 3-5 triggers per company.

Each trigger needs:
- type: one of "funding", "policy", "hiring", "sector", "competitor", "growth"
- text: one factual sentence describing the observable event (max 80 chars)
- time: relative timestamp ("3h ago", "2d ago", "1w ago")

The triggers should come from DIFFERENT categories for each company.
A company should not have 3 "funding" triggers — it should have one funding,
one sector, one hiring, etc. This variety is what makes the recommendation
feel multi-dimensional rather than single-signal.

Trigger text rules (same factual compression style as summaries):
- Start with what happened, not what it means
- Include a number or proper noun
- No interpretation: "validates", "signals conviction", "positions for"

Good triggers:
- funding: "€30M Series A closed; Nordic defence fund consortium lead"
- policy: "NATO defence spending mandate raised to 3.5% GDP (binding)"
- hiring: "3 senior procurement roles posted — Tallinn, Brussels"
- sector: "European defence tech VC volume +140% YoY (Dealroom)"
- competitor: "PlanRadar acquired by RIB Software — consolidation signal"
- growth: "Job postings +40% QoQ; 12 new engineering roles"

Bad triggers:
- "Company is well-positioned to capture significant market share"
- "Strong investor conviction validates the thesis"
- "Critical inflection point in the market"

If the pipeline can only extract 1-2 real triggers from RSS data, that's
honest — show 1-2 real ones rather than generating 5 fake ones. But check
whether the pipeline is already extracting multiple signals and only
displaying the first one.

Also check: are the trigger types being passed to the frontend? The UI
should show different emoji icons per trigger type (funding=💰, policy=📜,
hiring=👤, sector=📈, competitor=⚔️, growth=🚀). If all triggers show
the same icon, the type field may not be populated.
```

### What "done" looks like

- Most companies show 2-4 triggers with different type icons
- Each trigger reads as an observable event, not an interpretation
- The drawer feels like an evidence log, not a generated narrative

---

## Fix 4: Populate Team Signals

Every company currently shows "unassigned" for owner and no CRM/last-touch data.
This makes the product feel unused. Even with sample data, populating these fields
for a subset of companies demonstrates the workflow.

### Claude Code prompt

```
Update the company data to add team workflow signals. This is sample data
to demonstrate the feature — it doesn't need to come from a real CRM yet.

For approximately 30% of companies (roughly every 3rd company, biased
toward higher-scored ones since those are more likely to have been reviewed):

1. Set owner to "MR" (Manfredi's initials)
2. Set crmSync to true
3. Set lastTouch to a plausible value:
   - "Reviewed 2d ago"
   - "Intro sent 1w ago"
   - "Call scheduled"
   - "Passed — wrong stage"
4. Set status to something other than "new":
   - "viewed" for ones with lastTouch = "Reviewed..."
   - "contacted" for ones with lastTouch = "Intro sent..."

For the remaining ~70%, keep owner as null, crmSync as false,
lastTouch as null, and status as "new".

This creates a realistic mix where:
- Some companies have been triaged and assigned
- Most are still fresh/new
- A few show active outreach
- The "Contacted: 0" KPI in the header should update to reflect
  the actual count of contacted companies

Make sure the owner initials badge renders in both discovery cards
and triage table rows. The evidence metadata row in discovery view
should show the owner badge and lastTouch text when present.
```

### What "done" looks like

- ~30% of companies show "MR" avatar instead of "unassigned"
- A few companies show green CRM checkmark badge
- 2-3 companies have "contacted" status with "Intro sent" last touch
- The Contacted KPI at the top shows a non-zero number
- Triage view's Owner column has a mix of avatars and dashes
- The product looks like someone is actually using it

---

## Verification Checklist

After all four fixes, do a final visual check:

- [ ] Score distribution spans from ~20 to ~85 (not clustered at 65-81)
- [ ] Companies with 1 source have low Source scores in breakdown
- [ ] Companies with no funding have Capital = 0 in breakdown
- [ ] No summary contains "signals", "validates", "inflection point", or "critical moment"
- [ ] Every summary is ≤120 characters and starts with a hard fact
- [ ] Most companies have 2+ triggers in Why Surfaced drawer
- [ ] Triggers show different type icons (not all the same)
- [ ] ~30% of companies have owner assigned
- [ ] Contacted KPI > 0
- [ ] CRM badges visible on 3-5 companies
- [ ] At least 3 different status values visible in triage view (new, viewed, contacted)
