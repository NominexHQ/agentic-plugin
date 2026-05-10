---
name: agentic:build_skill
description: "Design and implement Claude Code plugin skills end-to-end: analyze existing plugin conventions, spec invocation contract and workflow, confirm design with the user, then write SKILL.md plus any required reference/context files and validate consistency. Use for new skills, major rewrites, or expanding a plugin's capability surface."
argument-hint: "[plugin-name-or-path] [skill-name-or-description]"
---

# Agentic Build Skill

Spec and build a new Claude Code plugin skill. `$ARGUMENTS` should include the target
plugin (name or path) and the skill name or short description. If either is missing,
ask the user before continuing.

## Step 0 - Fetch Reference Specs

Fetch the following before doing any analysis:

- **https://code.claude.com/docs/en/plugins** - plugin creation and structure
- **https://code.claude.com/docs/en/plugins-reference** - manifest schema and component paths
- **https://code.claude.com/docs/en/sub-agents** - subagent frontmatter and fields

Read these before continuing. Do not rely on training-time knowledge when the docs are
available.

## Step 1 - Understand the Claude Code Runtime

Before speccing anything, study the existing plugin anatomy:

1. Resolve the plugin path using this order:
   - `.claude/plugins/<name>/` in the current project
   - `<name>/.claude-plugin/` relative to cwd
   - `~/.claude/plugins/cache/` latest matching entry
   - ask the user if unresolved

2. Read these files if present:
   - `.claude-plugin/plugin.json`
   - `skills/*/SKILL.md`
   - `skills/*/reference.md`
   - `context/*.md`
   - `references/*.md`
   - `hooks/hooks.json`

3. Capture conventions from the plugin before proceeding:
   - Skill frontmatter style (`name`, `description`, `argument-hint`)
   - Skill body structure (workflow phases, checklists, output sections)
   - How sibling skills reference shared context/reference docs
   - Invocation naming and directory naming style
   - Any plugin-specific guardrails or mandatory sections

If conventions are inconsistent, note that and propose one consistent style in the spec.

## Phase 2 - Spec the New Skill

Work through this checklist with the user:

1. **Purpose** - What does the skill do in one sentence? What user intent should trigger it?
2. **Invocation contract** - How should `$ARGUMENTS` be interpreted?
3. **Inputs** - What files/context should the skill read?
4. **Workflow** - What ordered steps should the skill execute?
5. **Outputs** - What deliverables should it produce?
6. **Dependencies** - Which sibling skills/files does it rely on?
7. **Edge cases** - Missing args, missing files, ambiguous intent, partial state.
8. **Naming** - Final skill id, directory name, and user-facing description.

After gathering answers, provide a complete spec summary and ask the user to confirm.

## Phase 3 - Confirm the Spec

Present this template and ask for explicit confirmation before writing files:

```text
Skill name:         <agentic:...>
Directory:          skills/<name>/
Main file:          skills/<name>/SKILL.md
Supporting files:   <none | list>

Purpose:
  <one sentence>

Invocation contract:
  $ARGUMENTS -> <parsed form>

Workflow:
  1. <step>
  2. <step>

Outputs:
  - <deliverable>

Dependencies:
  - <files/skills>

Edge cases:
  - <case> -> <behavior>
```

Ask: "Does this spec look right before I write the files?"

## Phase 4 - Write the Files

Write in this order:

### 4a - Create `skills/<name>/SKILL.md`

Use valid frontmatter and a clear step-based workflow.

Required frontmatter keys:
- `name`
- `description`

Recommended:
- `argument-hint`

Body structure:
- Opening purpose paragraph
- Numbered workflow steps
- Edge-case handling section
- Output deliverables section

### 4b - Add supporting files when needed

Only create extra files if the spec requires them:
- `skills/<name>/reference.md` for large static guidance
- `references/<file>.md` for reusable plugin-wide docs
- `context/<file>.md` for session context templates

Do not add files that are not justified by the confirmed spec.

### 4c - Keep plugin consistency

If the plugin has a documented index/list of skills, update it.
If there is no index convention, do not invent one.

## Phase 5 - Validate

After writing files, run lightweight checks:

1. Skill directory and file exist at `skills/<name>/SKILL.md`.
2. Frontmatter parses and includes required keys.
3. `name` in frontmatter matches intended invocation.
4. Workflow in body matches confirmed spec (no missing phases).
5. Any referenced supporting files actually exist.

Report any mismatches and fix them before finishing.

## Claude Code Skill Conventions (Reference)

- Keep instructions explicit and executable; avoid vague prose.
- Prefer stepwise workflows over long narrative paragraphs.
- Include edge-case behavior instead of leaving implicit assumptions.
- Reuse existing plugin conventions before introducing new structure.
- Keep skill scope narrow; compose with other skills when needed.

## Output Deliverables

- `skills/<name>/SKILL.md` (required)
- Optional support files created by spec (if any)
- Validation report showing path, frontmatter, and workflow checks
