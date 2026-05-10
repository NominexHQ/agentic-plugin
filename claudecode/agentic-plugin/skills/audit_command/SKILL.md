---
name: agentic:audit_command
description: "Audit an OpenCode plugin command across 12 dimensions: purpose, contract, communication style, response patterns, workflow, instruction content, dependencies, lifecycle, tool interactions, resources, configuration, and permissions. The 'command' is the TypeScript tool definition plus its paired instruction file. Use when the user asks to audit, review, or analyse an OpenCode plugin command or tool."
argument-hint: "[plugin-name-or-path] [command-name]"
---

# Agentic Audit Command

Produce a comprehensive audit of an OpenCode plugin command. $ARGUMENTS specifies
the plugin (name or path) and optionally a single command to focus on. If no
arguments are provided, ask the user which plugin and command(s) to audit.

## Step 0 — Fetch Reference Specs

Fetch the following before doing any analysis:

- **https://opencode.ai/docs/plugins/** — OC plugin system, tool conventions, hook types
- **https://opencode.ai/docs/skills/** — OC skill format and discovery paths
- **https://opencode.ai/docs/agents/** — OC agent frontmatter, modes, permissions

Read these before continuing. The fetched content is authoritative; do not rely on
prior training knowledge about the OpenCode plugin API.

## Step 1 — Locate the Plugin

Parse $ARGUMENTS: first token = plugin name or path, second = command name (optional).

**Resolution order for a plugin name:**
1. `.opencode/plugins/<name>.ts` in the current project
2. Relative path from cwd if it looks like a path
3. Ask the user if nothing is found

**For a named command within a plugin:** the tool definition is inside the plugin's
`.ts` file. The paired instruction file is at
`.opencode/plugins/instructions/<plugin>-<command>.md`.

Once located:

- Glob `.opencode/plugins/*.ts` to list all plugin files
- Read the target plugin `.ts` file in full
- Read `.opencode/plugins/instructions/<plugin>-<command>.md` (or all `<plugin>-*.md`
  files if no command was specified)
- Read `.opencode/plugins/instructions/<plugin>-system.md` if it exists — this is
  often where the tool's invocation trigger is defined

List the commands found and confirm with the user before proceeding. If a specific
command was requested and doesn't exist, list what is available.

## Step 2 — Understand the Command Structure

An OpenCode plugin command has two layers — audit both:

**Layer 1: TypeScript tool definition**
- `description` — what Claude Code uses to decide when to invoke it
- `args` — Zod schema; what arguments the user or LLM passes
- `execute()` — what runs at call time; the context it gathers; the JSON payload it returns
- Return shape: `status` field (`INSTRUCTION_READY` or `ERROR`), payload fields

**Layer 2: Paired instruction file**
- The `.md` content the LLM follows after `execute()` returns `INSTRUCTION_READY`
- Phase structure, decision logic, output deliverables
- How it references the payload fields from `execute()`

Treat both layers together as "the command." A gap in either layer is a gap in the command.

## Step 3 — Audit

Produce a comprehensive audit covering all 12 dimensions. If a specific command was
requested, focus on it — but keep whole-plugin context in mind.

1. **Purpose & intent** — What problem does this command solve? Who uses it?
   When is it invoked? What is it trying to accomplish?

2. **Contract** — Arguments (Zod schema, required vs optional), invocation modes,
   triggers (description field, system context injection), preconditions, expected
   outcomes.

3. **Communication style** — How does the instruction file talk to the LLM and user?
   Tone, verbosity, format, phase structure. Is it appropriate for the intended workflow?

4. **Response patterns** — What the `execute()` returns. How does the instruction
   file handle `INSTRUCTION_READY` vs `ERROR` vs other statuses? Edge cases?

5. **End-to-end process** — From tool invocation → `execute()` → payload →
   instruction file phases → output deliverables. Are steps ordered correctly?
   Are any missing or unreachable?

6. **Instruction content** — What the instruction `.md` says. Are the instructions
   clear? Complete? Internally consistent? Are there gaps the LLM would have to
   guess at? Does the instruction file reference payload fields that `execute()`
   actually provides?

7. **Dependencies** — Other tools invoked (`agentic_build_command`, etc.), memory
   files read, external services, shell scripts. Are dependencies explicit?
   Undocumented assumptions?

8. **Lifecycle** — Is this one-shot or part of a multi-turn workflow? How is it
   triggered — by description match, `experimental.chat.system.transform` injection,
   direct user invocation? What hook events does the plugin use?

9. **Tool interactions** — What does it call? What calls it? How does it integrate
   with the plugin's system context injection? Note sibling tools by name.

10. **Resources & files** — What `execute()` reads. What the instruction file
    tells the LLM to write. Are side effects documented and appropriate?

11. **Settings & configuration** — What is configurable via plugin constants,
    instruction overrides (`memory/instructions/` path), or args? Are defaults
    documented?

12. **Permissions model** — Does `execute()` validate inputs before using them in
    file paths or shell commands? Any security-relevant operations?

## Bug & Flaw Surfacing

For each issue found, assign a severity:

- **CRITICAL** — Makes the command non-functional. Broken `execute()` logic, payload
  fields missing that the instruction file expects, unreachable instruction states,
  fatal contradictions between layers.

- **WARNING** — Ambiguous instruction phases, edge case risk in `execute()`, payload
  fields the instruction file doesn't use, implicit assumptions, gaps requiring the
  LLM to guess.

- **NOTE** — Style issues, inconsistent naming between layers, incomplete coverage
  of minor paths, things that could be clearer without affecting correctness.

Do not propose fixes unless the user explicitly asks.

## Clarification Questions

When something cannot be determined from the content alone — intended behavior for
an ambiguous path, undocumented dependency, implicit assumption — ask the user.
Keep questions purposeful and grouped.

## Spec Deliverable

When all dimensions are covered and issues surfaced: produce a structured narrative
spec document covering both layers of the command.

At the end, explicitly seek user concurrence:
- Confirm the audit is complete
- Flag anything left unresolvable without further information
- Ask whether they want fixes or changes proposed
