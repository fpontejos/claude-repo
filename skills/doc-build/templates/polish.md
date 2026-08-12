# Template: polish register — objective specification voice

> **Editing standard** for the optional Polish phase of the `/doc-build` skill —
> applied after a build by fresh agents. Self-contained: it does not
> depend on any other skill being installed. Scope: this document defines *how the prose
> should read*; the polish agent's operating constraints (assigned files, no factual
> changes, no git, no builds) come from the dispatch prompt in SKILL.md §Polish.

Documentation in this register communicates information — behaviours, constraints,
decisions, observations — as directly as possible. It describes what is known, required,
observed, decided, or proposed. It does not persuade the reader, demonstrate expertise,
build trust, or advocate for an outcome.

The result should read as a description of the subject matter, not an explanation of why
the reader should agree with it. That single test — *is this describing, or is it
arguing?* — resolves most edits below.

## Core moves

**State facts before interpretation.** Present the observable fact, requirement,
decision, or condition first; add interpretation only if it carries information the
reader needs.

- Prefer: *The system stores qualification envelopes with author, date, and evidence references.*
- Avoid: *Trust depends on knowing who created an envelope, so the system stores author information.*

**Separate requirements from rationale.** Express requirements, constraints, and
behaviours independently of the reasons behind them. Include rationale only when it
materially affects implementation, prioritisation, or interpretation.

- Prefer: *The interface shall display the source of each effective requirement.*
- Avoid: *Because engineers need confidence in the origin of requirements, the interface should display the source.*

**Describe behaviour, not intention.** Specify what the subject does, contains, permits,
requires, or produces — not what it hopes to achieve.

- Prefer: *Candidates can be compared by cost, lead time, and qualification impact.*
- Avoid: *The goal is to help engineers make better decisions.*

**State the conclusion, then support it.** Begin each section with the primary
statement, then define or elaborate. Avoid introductions that circle before reaching the
point.

- Prefer: *The system supports three evaluation modes.* (then define them)
- Avoid: A paragraph of context preceding the fact that there are three modes.

## Tone

Keep the tone neutral, impersonal, and measured.

**Neutral** — do not praise, criticise, defend, justify, or speculate unless required.
- Prefer: *The model reports a confidence interval.*
- Avoid: *The model honestly admits its uncertainty.*

**Impersonal** — focus on the system, process, or subject. Reference emotion, trust,
frustration, or convenience only when these are themselves the requirement.
- Prefer: *The system displays unavailable options with exclusion reasons.*
- Avoid: *Users lose confidence when options disappear unexpectedly.*

**Measured** — drop emphatic framing. Delete these words and describe the fact instead:
*obviously, clearly, critically, importantly, essential, vital, dangerous, powerful,
transformative.* If something matters, the description shows it; the label adds nothing.

## Language

**Concrete nouns.** Prefer terms like *requirement, constraint, estimate, process,
envelope, approval, configuration.* Avoid *journey, story, vision, philosophy,
experience* unless one of them is the actual subject.

**Precise verbs.** Prefer *displays, records, evaluates, generates, validates,
calculates, identifies, stores.* Avoid *handles, deals with, manages, addresses* unless
no more precise term exists — these usually signal that the specific behaviour hasn't
been pinned down.

**Minimal modifiers.** Include only adjectives and adverbs required for meaning.
- Prefer: *The estimate includes a confidence interval.*
- Avoid: *The estimate includes a carefully calculated confidence interval.*

**No rhetorical contrast.** State what the thing is, not what it isn't.
- Prefer: *The system functions as a decision-support platform.*
- Avoid: *It is not a workflow engine; it is a decision-support platform.*

**No persuasive framing.** Don't rank importance for the reader.
- Prefer: *The system records traceability information.*
- Avoid: *The most important feature is traceability.*

## Structure

Organise content by topic, function, or responsibility, with one subject per section. Do
not mix requirements, rationale, implementation detail, and future considerations in the
same paragraph.

Use hierarchy — sections, subsections, lists, tables — over long narrative prose, so
structure communicates relationships before the reader examines details. Reserve prose
for cases where the relationships between statements genuinely need connective
explanation.

## Requirements and decisions

Express requirements directly and consistently, and don't bury them inside discussion:

> The system shall record the source of each requirement.
> The report shall include compliance status.
> Each estimate shall identify its basis.

Distinguish current state, proposed state, requirement, recommendation, and assumption.
Do not merge them into a single statement — a reader must be able to tell what is true
now from what is being proposed.

## Uncertainty

State uncertainty explicitly. When information is incomplete, identify what is unknown,
what assumptions exist, what confidence exists, and what evidence is available. Vague
hedging ("may not be entirely reliable") communicates less than a specific limitation.

- Prefer: *The prediction has low confidence due to limited validation data.*
- Avoid: *The model may not be entirely reliable.*

Make the strongest claim the evidence supports, and no stronger.

- Prefer: *The estimate is based on historical qualification records.*
- Avoid: *The estimate accurately reflects expected qualification costs.*

## Worked transformations

Each pair shows input in a non-objective register and the rewrite this register
produces. Match the transformation, not just the topic.

**Narrative → objective**
- In: *Engineers often struggle to understand the consequences of design changes because qualification data is fragmented across multiple systems. The platform addresses this by surfacing qualification impacts immediately.*
- Out: *The platform displays qualification impacts for each design change. Qualification data is sourced from historical qualification records and active qualification envelopes.*

**Persuasive → objective**
- In: *Trust is earned by showing provenance and lost when decisions are hidden.*
- Out: *The system records provenance for requirements, decisions, and qualification data.*

**Philosophical → objective**
- In: *A proposal should never become detached from the originating brief.*
- Out: *Each proposal maintains traceability to originating requirements.*

## Polish-pass boundaries

When applying this standard to an existing docs suite, edits are limited to register and
clarity. Preserve:

- factual content, code examples, symbol references, and table data;
- nav entries, file paths, anchors, and heading structure that links depend on;
- Mermaid fences and code-block language tags.

A page already in this register needs no edit; "no changes needed" is a valid per-file
outcome.

## Summary

Describe rather than persuade; state rather than argue; specify rather than justify;
organise rather than narrate. Distinguish facts, requirements, assumptions, and
decisions; use precise terminology; represent uncertainty explicitly; minimise
rhetorical language.
