---
name: agentic:port_command
description: "Port an OpenCode plugin command to a Claude Code equivalent: either a CC skill (SKILL.md), a CC sub-agent (.claude/agents/<name>.md), or a CC slash command (commands/<name>.md). The command reads the OC TypeScript tool + paired instruction file, walks through a three-way output decision, and writes the chosen target. Use when the user asks to port, migrate, or convert an OpenCode command to Claude Code."
argument-hint: "[plugin-name] [command-name]"
---

# Agentic Port Command

Port an OpenCode plugin command to a Claude Code equivalent. $ARGUMENTS specifies
the source plugin (name) and optionally a command name. If no arguments are given,
ask the user.

## Step 0 — Fetch Reference Specs

Fetch all of the following before doing any analysis:

**Claude Code (target):**
- **https://code.claude.com/docs/en/plugins** — CC plugin system, SKILL.md format, discovery
- **https://code.claude.com/docs/en/plugins-reference** — frontmatter fields, $ARGUMENTS, hooks
- **https://code.claude.com/docs/en/sub-agents** — CC agent format and invocation

**OpenCode (source):**
- **https://opencode.ai/docs/plugins/** — OC plugin system, tool() factory, Zod, hooks
- **https://opencode.ai/docs/skills/** — OC skill format and discovery
- **https://opencode.ai/docs/agents/** — OC agent frontmatter and invocation

Read these before continuing. Do not rely on training-time knowledge about either system.

## Step 1 — Locate and Read the Source Command

Parse $ARGUMENTS: first token = plugin name; second = command name (optional).

**Resolution order:**
1. `.opencode/plugins/<name>.ts` in the current project
2. Relative path from cwd if it looks like a path
3. Ask the user if nothing is found

Once located:

- Read the plugin `.ts` file in full
- Read `.opencode/plugins/instructions/<plugin>-<command>.md` (or all `<plugin>-*.md` if no command specified)
- Read `.opencode/plugins/instructions/<plugin>-system.md` if it exists
- Also Glob `skills/<name>/SKILL.md` (OC skills directory) for sibling skills

Identify all `tool()` definitions. If more than one exists and no command was specified,
ask the user which one to port.

## Phase 1 — Understand the Source Command

Before choosing a target, document the source command across these dimensions:

1. **Purpose** — What problem does this command solve? Who triggers it? Under what conditions?
2. **Contract** — Zod args schema, required vs optional, expected invocation pattern
3. **Execute()** — What does it read/compute? How does it transform context into payload?
4. **Payload** — What fields does execute() return? How does the instruction file use them?
5. **Instruction phases** — How many phases? What does each phase produce?
6. **Output deliverables** — What does the command write, suggest, or decide? To which files?
7. **Dependencies** — Other OC tools called, memory files read, shell commands run, external calls
8. **Lifecycle** — One-shot or multi-turn? Hook events? Triggered by description or system injection?
9. **Tool interactions** — What does it call? What calls it? Sibling commands?
10. **Configuration** — DEFAULT_* constants, instruction override paths, user-facing settings
11. **Side effects** — Files written, memory updated, sessions started
12. **Permissions** — Does it validate paths or shell args? Security-sensitive operations?

Surface any gaps or ambiguities. Ask the user to clarify before proceeding if needed.

## Phase 2 — Choose the CC Target

Determine whether the OC command maps best to:

**Target A — CC Skill** (`skills/<name>/SKILL.md`)

Choose when: the command is invoked by a user request within a conversation, primarily
produces instructions for the LLM to follow, benefits from `$ARGUMENTS`, is
topic-scoped, and does NOT require TypeScript execution at call time.

- The `execute()` body (context gathering) must be translated to inline CC instructions:
  "Glob files matching…", "Read the file at…", "WebFetch the URL…"
- The instruction `.md` body maps to the SKILL.md body below the frontmatter
- `$ARGUMENTS` replaces the Zod args schema for runtime input
- OC-only patterns that have no CC equivalent must be noted as gaps

**Target B — CC Sub-agent** (`.claude/agents/<name>.md`)

Choose when: the command orchestrates a long, multi-step workflow that benefits from
a dedicated agent context, has its own persona or tone, or needs to be invoked via
`@agent-name` rather than `/skill:name`. Typically: the instruction `.md` already
reads like an autonomous agent prompt.

- Named with `name: <agent-name>` in frontmatter
- `description` controls when it is auto-triggered
- Body maps to the instruction `.md` content, adapted for agent prompt style
- Context-gathering steps (from `execute()`) become inline instructions in the body

**Target C — CC Slash Command** (`commands/<name>.md`)

Choose when: the workflow is conversational and primarily driven by user turn-by-turn
input, or the command is a lightweight helper that doesn't need skill-style invocation.
Commander-style prompts with structured phases map here.

- Stored as `commands/<name>.md` (no frontmatter required; plain Markdown prompt)
- No `$ARGUMENTS` — user provides context conversationally
- Context-gathering from `execute()` becomes inline instructions in the body

### Three-Way Decision Table

| Criterion | Skill (A) | Agent (B) | Command (C) |
|---|---|---|---|
| Triggered by | `/plugin:skill` | `@agent` | `/command` |
| Arguments | `$ARGUMENTS` | conversational | conversational |
| Autonomous | no | yes | no |
| Execute() side effects | inline gather | inline gather | inline gather |
| Multi-step orchestration | some | primary | light |

Present your recommendation with rationale. Ask the user to confirm or override.

## Phase 3 — Build the CC Equivalent

### Target A — CC Skill

Write `skills/<derived-name>/SKILL.md`.

Frontmatter:
```yaml
---
name: <plugin>:<derived-name>
description: "<one-sentence description>"
argument-hint: "<args hint>"
---
```

Body:
1. Opening paragraph: what this skill does and what the user provides
2. Context-gathering section: translate `execute()` reads into inline CC instructions
   (Glob, Read, WebFetch as needed)
3. Main instruction content from the OC instruction `.md`, adapted for CC:
   - Remove all OC-specific JSON payload references; replace with text the LLM reads
   - Replace OC hook references with CC equivalents if any; flag non-translatable ones
4. Output section: what the skill produces

Document any OC patterns that couldn't be translated:
- TypeScript-level logic (regex, API calls, structured JSON transforms) that has no
  direct CC equivalent
- System-level injections (`experimental.chat.system.transform`)
- OC-only tool chaining patterns

### Target B — CC Sub-agent

Write `.claude/agents/<derived-name>.md`.

Frontmatter:
```yaml
---
name: <derived-name>
description: "<one-sentence description>"
---
```

Body: autonomous agent prompt adapted from the OC instruction content. Use imperative
second-person ("You are…", "Your task is…"). Include inline context-gathering steps
translated from `execute()`.

### Target C — CC Slash Command

Write `commands/<derived-name>.md`.

Plain Markdown. No frontmatter required. Structured prompt with:
1. Role / context for the conversation
2. Context-gathering instructions translated from `execute()`
3. Phases / steps from the OC instruction `.md`
4. Deliverables

---

## Output Deliverables

For the chosen target:
- Write the target file directly (Edit/Write)
- List any OC patterns that could not be translated and why
- Note DefaultAlternatives (OC constants, system injection behavior, hook events) that
  are unavailable in CC
- Confirm with the user that the file looks correct before finalising
