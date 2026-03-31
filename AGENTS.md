<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Agent Protocol — snobaddy

This document is loaded by both Claude Code (`@AGENTS.md` in CLAUDE.md) and referenced by GEMINI.md.
It defines how any AI agent should work on this project.

## Starting a coding session

1. Read `CLAUDE.md` (or `GEMINI.md`) for full project context — tech stack, DB schema, file structure, conventions
2. Read `BACKLOG.md` — find the first `[ ]` item in the Queue
3. Read the linked spec file in full before writing a single line of code
4. Check `CHANGELOG.md` to understand what has already shipped
5. Implement per the spec, following the coding conventions in CLAUDE.md
6. After implementing, update:
   - `BACKLOG.md` — mark the item `[x]`
   - `CHANGELOG.md` — add a user-facing entry under a new version
   - `releases/v{version}-{slug}.md` — add a technical release note
7. Commit and push

**Never implement more than what the spec asks.** Don't add features, refactor unrelated code, or improve things that weren't broken.

## Adding a new spec

When asked to define or plan a feature (not implement it yet):

1. Create `specs/NN-feature-name.md` using the template below
2. Add a line to `BACKLOG.md` → Queue section:
   ```
   - [ ] **NN — Feature Name** · [spec](specs/NN-feature-name.md) · One-line summary
   ```
3. Do not implement anything yet — wait for explicit instruction

**Numbering:** use the next available two-digit number (check the highest existing spec).

## Spec template

```markdown
# Spec NN: Feature Name

## What it does
Plain English description of the feature from the user's perspective.

## What it does NOT do
Explicit scope boundaries to prevent scope creep.

## Data / DB changes
New tables, columns, or queries needed. Include SQL for any schema changes.

## API
New or modified routes. Method, path, auth requirement, request/response shape.

## UI
Pages and components. Describe layout and interactions. ASCII mockups if helpful.

## Files to create/modify
| File | Action |
|---|---|
| `path/to/file.ts` | Create / Modify — brief description |

## Acceptance Criteria
- [ ] Verifiable, testable condition
- [ ] Another condition
```

## Changelog discipline

Every commit that touches `src/` must also update `CHANGELOG.md`.
The git pre-commit hook enforces this — it will block commits that stage `src/` files without staging `CHANGELOG.md`.

- `CHANGELOG.md` — user-facing, plain English, grouped by version
- `releases/v{version}-{slug}.md` — technical detail (files changed, DB migrations, migration notes)

To skip for a WIP/draft commit: `git commit --no-verify`

## Working across agents (Claude ↔ Gemini)

- `CLAUDE.md` and `GEMINI.md` must always be kept in sync
- If you update `CLAUDE.md`, apply the identical change to `GEMINI.md` in the same commit
- Spec files and `BACKLOG.md` are shared — no duplication needed
- Both agents use the same `specs/` directory and the same `BACKLOG.md`

## DB access rules

- All DB queries go through `src/lib/db/*.ts` — never query Supabase directly in components or API routes
- Use `createClient()` from `@/lib/supabase-server` for auth-aware reads (respects RLS)
- Use `supabase` from `@/lib/supabase` (service role) for admin writes that must bypass RLS
- Never expose the service role key to the browser
