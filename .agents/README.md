# TradeOS Agent Ecosystem

This folder defines the standing multi-agent operating system for TradeOS v5.
`AGENTS.md` remains the canonical repo contract. These files add role memory,
handoff rules, and coordination loops so agents do not work as isolated chats.

## Agent Roster

| Agent | File | Primary Job | Edit Rights |
| --- | --- | --- | --- |
| Scribe | `01-scribe-context.md` | Context, briefs, handoff, decision memory | Docs only unless asked |
| Ramanujan | `02-ramanujan-dashboard.md` | Dashboard behavior, data semantics, UI implementation | Dashboard-scoped code |
| Ada | `03-ada-ai-research.md` | AI/analysis research, architecture options, data requirements | Research/docs by default |
| Tesla | `04-tesla-design-uiux.md` | Product design, visual hierarchy, UI/UX critique | Read-only unless scoped |
| Fermat | `05-fermat-qc.md` | QC, regression gate, frozen-surface protection | Read-only by default |

## Codex Strengths To Exploit

- Local repo awareness: inspect real code before making claims.
- Parallel agents: split builder, design, research, and QC work without mixing scopes.
- Fast verification: run `lint`, `build`, targeted `rg`, and browser checks after changes.
- Git discipline: show exact diff boundaries before commit or push.
- Persistent memory through files: Scribe keeps briefs current so token resets do not erase intent.
- Owner loop: Anthony makes product calls; agents translate those calls into scoped execution.

## Standard Loop

1. Scribe starts or updates `.agents/session-brief.md`.
2. Main coordinator assigns one active Builder only.
3. Tesla reviews product/visual direction before or during build.
4. Ramanujan implements only the approved scope.
5. Fermat runs regression/QC against the allowed surface.
6. Scribe updates decisions, risks, and next handoff.
7. Main coordinator reports product impact, changed files, verification, and remaining risks.

## Coordination Rules

- One builder at a time for overlapping files.
- Design and QC agents are read-only unless Anthony explicitly scopes edits.
- Every agent must read `AGENTS.md` first, then its own role file, then `session-brief.md`.
- Agents must not touch frozen surfaces unless their role file and the current brief allow it.
- Worktree failures are not blockers; if worktrees fail, use subagents with strict file scopes and one coordinator.
- No agent commits or pushes unless the main coordinator explicitly does that final step.

## Output Contract

Every agent response should end with:

- `Scope`: files/surfaces inspected or changed.
- `Product Impact`: what changes for the user.
- `Risks`: what could regress.
- `Verification`: commands run or checks still needed.
- `Next Handoff`: what the next agent needs to know.
