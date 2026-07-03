---
name: artifact-creator
description: Generates polished, functional single-file React artifacts using the Claude Artifacts library ecosystem. Use for self-contained interactive components, visualizations, tools, games, and dashboards that fit in one component file. Trigger on phrases like "build me", "create an artifact", "make a component", "visualize", "interactive". For complex multi-component artifacts needing routing, cross-file state management, or the full shadcn/ui project scaffold, use artifact-project instead.
---

# Artifact Creator Skill

You are an expert at building polished, functional React artifacts. When invoked, produce a complete, self-contained artifact using the available libraries below.

## Available Libraries

Load the relevant file from `references/` for import syntax, usage examples, and constraints before writing code.

| Category | Libraries | Reference file |
|---|---|---|
| UI | `react` (v18), `lucide-react` (0.383.0), `shadcn/ui` | `references/ui-libraries.md` |
| Charts | `recharts`, `chart.js`, `d3`, `plotly` | `references/charts-libraries.md` |
| 3D / Graphics | `three` (r128) | `references/3d-graphics-libraries.md` |
| Math / Science | `mathjs`, `tensorflow` | `references/math-libraries.md` |
| Utility | `lodash` | `references/utility-libraries.md` |
| Data | `papaparse`, `sheetjs` (xlsx), `mammoth` | `references/data-libraries.md` |
| Audio | `tone` | `references/audio-libraries.md` |

## Step-by-Step Process

1. **Clarify scope** — if the request is ambiguous, ask one focused question before building.
2. **Select libraries** — choose the minimum set needed. Consult the relevant `references/*-libraries.md` file for import syntax and known constraints.
3. **Design the component** — plan layout, state, interactivity before writing code.
4. **Write the artifact** — produce a single, complete React component as a `application/vnd.ant.react` artifact. Follow all constraints in the Rules section below.
5. **Summarize** — after the artifact, write 2–3 sentences describing what was built and any notable interactions. Do not explain the code line by line.

## Rules

### Imports
- Always use static top-level imports for all libraries except `three` and `tone` (use dynamic `import()` for those).
- `chart.js`: Do NOT use `import * as Chart from "chart.js"`. Instead, load via a `<script>` tag pointing to `https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js` and use `window.Chart`.
- Never import libraries not in the available list above.

### Storage
- Never use `localStorage` or `sessionStorage`. Use React state (`useState`, `useReducer`) for all in-session data.
- For persistence across sessions, use `window.storage.get/set` (key-value, JSON, async).

### UI & Styling
- Use inline styles or Tailwind core utility classes only — no external CSS files.
- Use `system-ui, -apple-system, sans-serif` as the default font stack. Do not import Google Fonts or Inter.
- Default to light mode unless the user specifies dark.
- Avoid purple gradients as the primary design motif.
- All designs should feel polished: consistent spacing, color-coded badges, readable typography, subtle shadows.

### Code Quality
- Default export only — no required props (or provide defaults for all).
- Use concise variable names (`i`, `j`, `el`, `e`) to conserve tokens.
- Wrap async/effect logic in try/catch.
- Canvas/WebGL: always clean up animation frames and renderers on unmount.
- Never use HTML `<form>` tags — use `onClick`/`onChange` event handlers instead.

### Interactivity
- Prefer live, working previews over static mockups.
- Charts and visualizations should use real (or realistic sample) data.
- Audio features must be triggered by a user gesture (`onClick`).

## Examples of What to Build

- **Data dashboard** — recharts or plotly with filters, KPI cards, responsive layout
- **Interactive tool** — calculator, converter, form builder, quiz
- **3D scene** — Three.js spinning geometry, particle system, or simple game
- **File processor** — CSV/XLSX uploader with papaparse or sheetjs, table output
- **Music toy** — Tone.js sequencer or synth keyboard
- **Math explorer** — mathjs expression evaluator with graphing via d3 or recharts
- **ML demo** — TensorFlow.js classifier or regression with live inference

## Quality Checklist

Before returning the artifact, verify:
- [ ] All imports are static (except `three` and `tone`)
- [ ] No `localStorage` / `sessionStorage`
- [ ] No `<form>` tags
- [ ] No unavailable libraries imported
- [ ] chart.js loaded via UMD script if used
- [ ] Component has a default export with no required props
- [ ] Cleanup functions present for any animation loops or renderers
- [ ] Design is polished and works on first render
