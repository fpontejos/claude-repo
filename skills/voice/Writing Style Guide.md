# Writing Style Guide: Objective Specification and Technical Documentation

## Purpose

Write to communicate information, requirements, decisions, constraints, observations, or analysis as clearly and directly as possible.

The document's purpose is to describe what is known, required, observed, decided, or proposed. It is not to persuade the reader, demonstrate expertise, build trust, justify design philosophy, or advocate for a particular outcome unless the document explicitly serves those purposes.

---

## Core Principles

### State facts before interpretation

Present the observable fact, requirement, decision, or condition first.

Prefer:

> The system stores qualification envelopes with author, date, and evidence references.

Avoid:

> Trust depends on understanding who created a qualification envelope, therefore the system should store author information.

---

### Separate requirements from rationale

Requirements, constraints, and behaviours should be expressed independently of the reasons behind them.

Prefer:

> The interface shall display the source of each effective requirement.

Avoid:

> Because engineers need confidence in the origin of requirements, the interface should display the source.

Include rationale only when it materially affects implementation, prioritisation, or interpretation.

---

### Describe behaviour, not intention

Specify what the documented subject does, contains, permits, requires, or produces.

Prefer:

> Candidates can be compared by cost, lead time, and qualification impact.

Avoid:

> The goal is to help engineers make better decisions.

---

### Prefer explicit statements over narrative

Use direct statements rather than conversational explanation.

Prefer:

> The workspace supports five workflow stages.

Avoid:

> The workspace is organised around five stages because this provides structure while preserving flexibility.

---

## Tone

### Neutral

Maintain a professional, observational tone.

Do not praise, criticise, defend, justify, or speculate unless explicitly required.

Prefer:

> The model reports a confidence interval.

Avoid:

> The model honestly admits uncertainty.

---

### Impersonal

Focus on the system, process, requirement, or subject.

Minimise references to emotions, trust, frustration, convenience, or user psychology unless these are themselves requirements.

Prefer:

> The system displays unavailable options with exclusion reasons.

Avoid:

> Users lose confidence when options disappear unexpectedly.

---

### Measured

Avoid emphatic language.

Avoid terms such as:

* obviously
* clearly
* critically
* importantly
* essential
* vital
* dangerous
* powerful
* transformative

Replace them with factual descriptions.

---

## Structure

### Lead with the conclusion

Begin sections with the primary statement.

Prefer:

> The system supports three evaluation modes.

Then define the modes.

Avoid lengthy introductions before reaching the main point.

---

### Group related information

Organise content by topic, function, or responsibility.

Each section should address one subject.

Avoid mixing:

* requirements,
* rationale,
* implementation details,
* future considerations,

within the same paragraph.

---

### Use hierarchical organisation

Prefer:

* Sections
* Subsections
* Lists
* Tables

over long narrative prose.

The document structure should communicate relationships before the reader examines details.

---

## Language

### Use concrete nouns

Prefer:

* requirement
* constraint
* estimate
* process
* envelope
* approval
* configuration

Avoid abstract wording such as:

* journey
* story
* vision
* philosophy
* experience

unless these are the actual subject.

---

### Use precise verbs

Prefer:

* displays
* records
* evaluates
* generates
* validates
* calculates
* identifies
* stores

Avoid vague verbs such as:

* handles
* deals with
* manages
* addresses

unless no more precise term exists.

---

### Minimise adjectives and adverbs

Include only those required for meaning.

Prefer:

> The estimate includes a confidence interval.

Avoid:

> The estimate includes a carefully calculated confidence interval.

---

### Avoid rhetorical contrast

Use direct statements instead of argumentative constructions.

Avoid:

> It is not a workflow engine; it is a decision-support platform.

Prefer:

> The system functions as a decision-support platform.

---

### Avoid persuasive framing

Do not attempt to convince the reader.

Avoid:

> The most important feature is traceability.

Prefer:

> The system records traceability information.

---

## Requirements and Decisions

### Express requirements directly

Use consistent requirement language.

Examples:

> The system shall record the source of each requirement.

> The report shall include compliance status.

> Each estimate shall identify its basis.

Avoid embedding requirements within discussion.

---

### Separate facts from recommendations

Distinguish between:

* current state,
* proposed state,
* requirement,
* recommendation,
* assumption.

Do not merge them into a single statement.

---

## Handling Uncertainty

### State uncertainty explicitly

When information is incomplete, identify:

* what is unknown,
* what assumptions exist,
* what confidence exists,
* what evidence is available.

Prefer:

> The prediction has low confidence due to limited validation data.

Avoid:

> The model may not be entirely reliable.

---

### Avoid overstating certainty

Use the strongest claim supported by available evidence and no stronger.

Prefer:

> The estimate is based on historical qualification records.

Avoid:

> The estimate accurately reflects expected qualification costs.

---

## Examples

### Narrative Style

> Engineers often struggle to understand the consequences of design changes because qualification data is fragmented across multiple systems. The platform addresses this by surfacing qualification impacts immediately.

### Objective Style

> The platform displays qualification impacts for each design change. Qualification data is sourced from historical qualification records and active qualification envelopes.

---

### Persuasive Style

> Trust is earned by showing provenance and lost when decisions are hidden.

### Objective Style

> The system records provenance for requirements, decisions, and qualification data.

---

### Philosophical Style

> A proposal should never become detached from the originating brief.

### Objective Style

> Each proposal maintains traceability to originating requirements.

---

## Summary

The document should:

* describe rather than persuade;
* state rather than argue;
* specify rather than justify;
* organise rather than narrate;
* distinguish facts, requirements, assumptions, and decisions;
* use precise terminology;
* represent uncertainty explicitly;
* minimise rhetorical language.

The result should read as a description of the subject matter rather than an explanation of why the reader should agree with it.
