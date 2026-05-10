---
name: agentic:port_skill
description: "Port a Claude Code plugin skill to its OpenCode equivalent. Analyses the skill across the full audit dimensions, chooses the right OpenCode target (OC Skill, OC Agent, or OC Plugin Command), then builds it. Use when the user asks to port, convert, or migrate a Claude Code skill to OpenCode."
argument-hint: "[plugin-name-or-path] [skill-name]"
---

# Agentic Port Skill

Translate a Claude Code plugin skill into its OpenCode equivalent. $ARGUMENTS
specifies the plugin (name or path) and the skill to port. Both are required — ask
the user if either is missing.

## Step 0 — Fetch Reference Specs

Fetch the following before doing any analysis:

**Claude Code (source system):**
- **https://code.claude.com/docs/en/plugins** — plugin creation and structure
- **https://code.claude.com/docs/en/plugins-reference** — manifest schema, component paths
- **https://code.claude.com/docs/en/sub-agents** — subagent frontmatter and fields

**OpenCode (target system):**
- **https://opencode.ai/docs/plugins/** — OC plugin system and tool conventions
- **https://opencode.ai/docs/skills/** — OC skill format and discovery paths
- **https://opencode.ai/docs/agents/** — OC agent frontmatter, modes, permissions

Read all six before continuing. These are the authoritative specs for both runtimes.

## Step 1 — Locate and Read the Skill

Parse $ARGUMENTS: first token = plugin name or path, second = skill name.

**Resolution order for a plugin name:**
1. `.claude/plugins/<name>/` in the current project
2. `.claude-plugin/` at `<name>/` relative to cwd
3. `~/.claude/plugins/cache/` — latest version under any marketplace subdirectory
4. Ask the user if nothing is found

Read:
- `skills/<skill-name>/SKILL.md` — the skill to port
- `skills/*/SKILL.md` — sibling skill names (for context; read headers only)
- `.claude-plugin/plugin.json` — manifest
- `hooks/hooks.json` — hook configuration
- `context/*.md` and `references/*.md` — if they exist

## Phase 1 — Understand the Skill

Develop a thorough understanding before designing anything. Use all 12 dimensions —
focused on "what does it do" rather than bug-hunting:

1. **Purpose & intent** — what problem does this solve? who uses it?
2. **Contract** — args (`$ARGUMENTS`), invocation modes, triggers, preconditions, outcomes
3. **Communication style** — tone, verbosity, format
4. **Response patterns** — what it returns, error handling, edge cases
5. **End-to-end process** — step-by-step workflow
6. **Instruction content** — what the SKILL.md says, gaps, ambiguities
7. **Dependencies** — other skills, memory files, tools, external services
8. **Lifecycle** — session vs. one-shot, hook bindings
9. **Skill interactions** — what it calls, what calls it
10. **Resources & files** — reads, writes, side effects
11. **Settings & configuration** — what's configurable
12. **Permissions** — access requirements, security-relevant operations

Detect agent/bot signals before designing: skill references to subagents, personas,
parallel execution, background tasks, model selection, or template variables like
`{{memory_root}}`.

Summarise your understanding and confirm with the user before proceeding to Phase 2.

## Phase 2 — Choose OpenCode Target

Three options. Confirm with the user before designing.

**A. OpenCode Skill** — if the skill is primarily instruction text, invoked on-demand,
and needs no context gathering at call time. Pure markdown, no TypeScript.

```markdown
---
name: skill-name          # required; must match directory name
description: One-sentence summary — 1–1024 chars.
---

<instruction content>
```

Place at `.opencode/skills/<name>/SKILL.md`. Discovered automatically by OpenCode
from `.opencode/skills/` and equivalents.

**B. OpenCode Agent** — if the skill defines a persona, distinct tool permissions,
or should run as a subagent via `@mention` or the Task tool.

```markdown
---
description: What this agent does and when to invoke it.
mode: subagent             # primary | subagent | all
model: claude-sonnet-4-5  # optional
tools:                     # optional allowlist
  - read
  - edit
permissions:               # optional fine-grained
  internal: deny
---

<agent system prompt>
```

Place at `.opencode/agents/<name>.md`.

**C. OpenCode Plugin Command** — if the skill needs to read files, gather structured
context, or build a payload before the LLM acts (i.e. meaningful `execute()` logic).

For Target C: present the full translation design (tool name, args, `execute()` logic,
instruction file content, system context snippet) to the user, then ask whether to:
- Write the TypeScript and instruction file directly from Claude Code (you have full
  tool access to do so via Write/Edit), or
- Hand the design off to OpenCode's `agentic_build_command` tool for iterative
  spec-and-build in an OC session

The user chooses based on which runtime they prefer to complete the work in.

---

### Translation Mappings (for all targets)

**Agent / bot dispatch:**
- Bot stamping with a stable persona → prefer Target B (OC Agent)
- Bot assembled dynamically from runtime context → prefer Target C, with `execute()`
  reading persona files at call time

**Bot template variables** (`{{memory_root}}`, `{{model}}`, `{{git_author}}`) →
resolve in `execute()` at call time; inject as concrete values in the payload.

**Background / parallel execution** → OpenCode runs sequentially. Note the
serialisation in the instruction file. Ask the user whether execution order matters
for correctness.

**Bot model selection** (`--model haiku`) → no OC equivalent. Note as informational.

**Firm non-translatables** — flag these explicitly and agree with the user before proceeding:
- **Isolated context per agent** — OpenCode has no context scoping between agents
- **Per-agent compaction** — no equivalent in OpenCode
- **True async background** — tool calls block in OpenCode

## Phase 3 — Build

**Target A:** Write the SKILL.md with valid frontmatter. The `name` field must match
the directory name exactly. No system context snippet needed.

**Target B:** Write the `.opencode/agents/<name>.md` with valid frontmatter. Use
`mode: subagent` unless it replaces the main interface. Include a system context
snippet if this agent should appear in a parent plugin's system file. Write the file
directly using Edit/Write.

**Target C:** See the two options above — write directly or hand off to OC.

## Output Deliverables

**A — OpenCode Skill:**
1. `SKILL.md` — complete, ready to write to `.opencode/skills/<name>/SKILL.md`
2. Translation notes — what didn't map, deferred items

**B — OpenCode Agent:**
1. Agent `.md` file — complete, ready to write to `.opencode/agents/<name>.md`
2. System context snippet — if the agent should appear in a parent plugin's system file
3. Translation notes — non-translatable parts, permissions rationale, model choice

**C — OpenCode Plugin Command:**
1. Full design spec (tool name, args, `execute()` logic, instruction file content,
   system context snippet)
2. Written TypeScript + instruction file (if writing directly from Claude Code), or
   the design handed off to OC as `agentic_build_command` requirements
3. Translation notes — non-translatable parts, deferred dependencies
