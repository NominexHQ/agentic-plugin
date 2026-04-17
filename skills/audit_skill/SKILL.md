---
name: agentic:audit_skill
description: "Audit a Claude Code plugin skill across 12 dimensions: purpose, contract, communication style, response patterns, workflow, instruction content, dependencies, lifecycle, skill interactions, resources, configuration, and permissions. Surfaces bugs and gaps with severity ratings. Use when the user asks to audit, review, or analyse a Claude Code plugin or specific skill."
argument-hint: "[plugin-name-or-path] [skill-name]"
---

# Agentic Audit Skill

Produce a comprehensive audit of a Claude Code plugin skill. $ARGUMENTS specifies the
plugin (name or path) and optionally a single skill to focus on. If no arguments are
provided, ask the user which plugin and skill(s) to audit before proceeding.

## Step 0 — Fetch Reference Specs

Before doing any analysis, fetch the Claude Code plugin reference documentation so
you are working from the live specification:

- Fetch **https://code.claude.com/docs/en/plugins** — plugin creation and structure
- Fetch **https://code.claude.com/docs/en/plugins-reference** — manifest schema, component paths, file locations
- Fetch **https://code.claude.com/docs/en/sub-agents** — subagent frontmatter and fields

Read these before continuing. Do not rely on prior training knowledge about these APIs —
the fetched content is authoritative.

## Step 1 — Locate the Plugin

Parse $ARGUMENTS:
- First token: plugin name or path
- Second token (optional): skill name to focus on

**Resolution order for a plugin name:**
1. `.claude/plugins/<name>/` in the current project
2. `.claude-plugin/` at `<name>/` relative to cwd
3. `~/.claude/plugins/cache/` — look for `<name>` under any marketplace subdirectory; pick the latest version
4. Ask the user if nothing is found

**For a path argument:** use it directly.

Once you have the plugin directory, confirm the path to the user and proceed.

## Step 2 — Read Plugin Content

Read the following (all that exist):

- `.claude-plugin/plugin.json` — manifest
- `skills/*/SKILL.md` — all skill files (or just the named skill if one was specified)
- `skills/*/reference.md` — any sibling reference files
- `context/*.md` — context files if the directory exists
- `references/*.md` — reference files if the directory exists
- `hooks/hooks.json` — hook configuration if it exists

List the skills found and confirm with the user before proceeding to the audit.
If a specific skill was requested and it doesn't exist, list what is available and ask.

## Step 3 — Audit

Produce a comprehensive audit covering all 12 dimensions. If a specific skill was
requested via $ARGUMENTS, focus on that skill — but keep the whole-plugin context in
mind for dependency and interaction dimensions.

1. **Purpose & intent** — What problem does this plugin/skill solve? Who uses it?
   When is it invoked? What is it trying to accomplish?

2. **Contract** — Arguments (`$ARGUMENTS` usage, `argument-hint`), invocation modes,
   triggers, preconditions, expected outcomes. What must be true before it runs?
   What must be true when it's done?

3. **Communication style** — How does it talk to the user? Tone, verbosity, format,
   use of headers and sections. Does it match what the stated audience would expect?

4. **Response patterns** — What it returns, in what format, under which conditions.
   How does it handle errors, empty states, ambiguous inputs, or missing data?

5. **End-to-end process** — Step-by-step workflow from invocation to completion.
   Are the steps ordered correctly? Are any steps missing or unreachable?

6. **Instruction content** — What the SKILL.md says. Are the instructions clear?
   Complete? Internally consistent? Are there gaps the LLM would have to guess at?

7. **Dependencies** — Other skills invoked, memory files read or written, git
   operations, external tools or services. Are these explicit or implicit? Are there
   undocumented assumptions about what must exist?

8. **Lifecycle** — When is this invoked? Is it session-persistent or one-shot?
   How does it relate to hook bindings in `hooks.json`? What triggers it?

9. **Skill interactions** — What does it call? What calls it? Note sibling skills
   by name. Do not recursively audit siblings unless the user asks.

10. **Resources & files** — What it reads, writes, creates, or deletes. Side effects
    on the filesystem or external state. Are side effects documented?

11. **Settings & configuration** — What is configurable? What uses hardcoded defaults?
    Are defaults reasonable? Is the configuration surface documented?

12. **Permissions model** — What access does it require? Any security-relevant
    operations? Does it validate inputs before using them in commands or file paths?

## Bug & Flaw Surfacing

For each issue found, assign a severity:

- **CRITICAL** — Makes the skill non-functional in its stated purpose. Broken
  preconditions, missing required steps, unreachable states, fatal contradictions.

- **WARNING** — Ambiguous instructions, edge case risk, missing validation, implicit
  assumptions that could break under realistic conditions, gaps that require the LLM
  to guess.

- **NOTE** — Style issues, inconsistent terminology, incomplete coverage of minor
  paths, things that could be clearer without affecting correctness.

Do not propose fixes unless the user explicitly asks. For each issue: state it,
explain the concern, and cite the specific content that causes it.

## Clarification Questions

When something cannot be determined from the content alone — intended behavior for
an ambiguous path, an undocumented dependency, an implicit assumption — ask the user.
Keep questions purposeful and grouped.

## Spec Deliverable

When all dimensions are covered and issues surfaced: produce a structured narrative
spec document. Choose a form that fits the plugin's complexity and the user's evident
needs.

At the end, explicitly seek user concurrence:
- Confirm the audit is complete
- Flag anything left unresolvable without further information
- Ask whether they want fixes or changes proposed
