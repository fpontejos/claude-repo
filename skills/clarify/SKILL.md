---
name: clarify
description: Clarify a task or decision through guided questioning
---

# Clarify: $ARGUMENTS

Help the user clarify a task or decision through guided, interactive questioning.

## Instructions

1. **Initial Context**: Ask 1-2 open conversational questions to understand the broad context (AskUserQuestion doesn't fit here - need free-form)

2. **Structured Clarification**: Once context is established, use the AskUserQuestion tool to efficiently gather:
   - Preferences between approaches
   - Scope boundaries
   - Priority trade-offs
   - Constraint selections

3. **Batch Related Questions**: Group related questions (up to 4) in a single AskUserQuestion call to reduce back-and-forth

4. **Follow-up Freely**: If user selects "Other", follow up conversationally

5. **Summary**: Provide structured summary of decisions

## When to Use AskUserQuestion

USE the tool when:
- Presenting 2-4 clear, distinct options
- Asking about preferences, priorities, or scope
- Options have meaningful trade-offs to describe
- Questions are independent enough to batch

DON'T use the tool when:
- Gathering open-ended context ("What's the goal?")
- Deep exploration where options aren't yet clear
- Single yes/no that's faster to ask directly

## Example Flow

### Phase 1: Context (Conversational)
"What aspect of [topic] needs clarification?"
*Wait for response*

### Phase 2: Structured Choices (AskUserQuestion)

Use the AskUserQuestion tool with questions like:

```yaml
questions:
  - question: "Which approach do you prefer for X?"
    header: "Approach"
    options:
      - label: "Option A (Recommended)"
        description: "Faster, less flexible"
      - label: "Option B"
        description: "More complex, more control"
    multiSelect: false

  - question: "What should be in scope?"
    header: "Scope"
    options:
      - label: "Core feature only"
        description: "Minimal implementation"
      - label: "With edge cases"
        description: "Production-ready"
      - label: "Full solution"
        description: "Including tests, docs"
    multiSelect: false
```

### Phase 3: Summary
Provide structured output (see Output Format below)

## Question Templates for AskUserQuestion

### Priority Trade-offs
```yaml
question: "What's more important for this task?"
header: "Priority"
options:
  - label: "Speed"
    description: "Get it working quickly, refine later"
  - label: "Quality"
    description: "Take time to do it right"
  - label: "Flexibility"
    description: "Easy to change/extend later"
multiSelect: false
```

### Scope Definition
```yaml
question: "What scope makes sense?"
header: "Scope"
options:
  - label: "Minimal"
    description: "Just the core requirement"
  - label: "Standard"
    description: "Core + common edge cases"
  - label: "Comprehensive"
    description: "Full solution with tests"
multiSelect: false
```

### Approach Selection
```yaml
question: "Which approach should we take?"
header: "Approach"
options:
  - label: "[Approach A] (Recommended)"
    description: "[Why A is good]"
  - label: "[Approach B]"
    description: "[Why B is good]"
multiSelect: false
```

### Constraint Selection
```yaml
question: "Which constraints apply?"
header: "Constraints"
options:
  - label: "Backward compatible"
    description: "Must not break existing behavior"
  - label: "Performance critical"
    description: "Speed/memory constraints apply"
  - label: "Minimal dependencies"
    description: "Avoid adding new libraries"
multiSelect: true
```

## Output Format

After clarification is complete, provide:

```
## Clarification Summary

**Topic**: [What was clarified]

**Key Points**:
- Point 1
- Point 2
- Point 3

**Decisions Made** (if applicable):
- Decision 1
- Decision 2

**Next Steps**:
- Action 1
- Action 2
```

## Decision Persistence

### When to Persist

**Always persist** when ALL of these conditions are met:
1. Memory bank exists (`.claude/memorybank/` directory found)
2. Decisions were made during clarification (not just information gathering)
3. Decisions affect project direction, approach, or scope

### What to Persist

Record to `.claude/memorybank/progress.md`:

```markdown
### Clarification: [Topic] ([Date])

**Decisions Made**:
| Decision | Rationale | Impact |
|----------|-----------|--------|
| [Decision 1] | [Why this was chosen] | [What areas affected] |
| [Decision 2] | [Why this was chosen] | [What areas affected] |

**Context**: [Brief context from clarification]
```

### Process

1. **After clarification summary is presented**, check if memory bank exists
2. **If memory bank exists and decisions were made**:
   - Get current timestamp
   - Append decision entry to progress.md
   - Update session.md if focus changed
   - Inform user: "Decisions recorded to memory bank"
3. **If no memory bank**: Show warning from Error Handling section

### Optional: Update session.md

If clarification changed the current focus or approach:

```markdown
## Focus Area
[Updated focus based on clarification]

## Recent Work ([date])

### Clarification Completed
- Clarified: [topic]
- Key decisions: [brief list]
```

### User Notification

After persisting:

```
## Decisions Recorded

Clarification decisions have been saved to:
- progress.md: Decision log with rationale
[- session.md: Updated focus area (if changed)]

Ready to proceed. [Skill chaining suggestion]
```

---

## Skill Chaining

After clarification is complete, suggest appropriate next actions:

| Situation | Suggestion |
|-----------|------------|
| Clarified approach/plan | "Run `/plan` to create implementation plan with these decisions" |
| Clarified requirements | "Run `/document` to record these decisions in progress.md" |
| Resolved blocker | "Continue with work. Run `/logwork add` to log progress" |
| Clarified scope | "Ready to proceed. Start with: [first step based on decisions]" |
| Significant decisions made | "Run `/document` first to persist decisions, then `/plan` to create detailed plan" |
| Clarified but still uncertain | "Consider `/clarify [different aspect]` for remaining ambiguity" |

---

## Error Handling

### No Memory Bank

If `.claude/memorybank/` doesn't exist when trying to record decisions:

```
## Note: Memory Bank Not Found

Clarification complete. However, memory bank not found at `.claude/memorybank/`.

To persist these decisions for future sessions, run `/onboard-claude` to initialize the memory bank, then run `/document` to record the decisions made during clarification.
```

**Important**: Clarify can still run without memory bank (for ad-hoc clarification), but should warn if decisions can't be persisted
