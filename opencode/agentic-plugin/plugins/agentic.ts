import type { Plugin } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

// ============================================================================
// OC MODEL STATE — cross-platform resolution
// ============================================================================

function getOcStateDir(): string {
  if (process.env.XDG_STATE_HOME) return join(process.env.XDG_STATE_HOME, "opencode");
  if (process.platform === "win32") return join(process.env.LOCALAPPDATA || "", "opencode");
  return join(process.env.HOME || "", ".local", "state", "opencode");
}

interface OcModelState {
  favorites: string[];
  connected: string[];
  all: string[];
}

function loadOcModelState(): OcModelState {
  const modelPath = join(getOcStateDir(), "model.json");
  const empty: OcModelState = { favorites: [], connected: [], all: [] };

  let raw: string;
  try { raw = readFileSync(modelPath, "utf-8"); } catch { return empty; }

  try {
    const data = JSON.parse(raw) as {
      recent?: Array<{ providerID: string; modelID: string }>;
      favorite?: Array<{ providerID: string; modelID: string }>;
      variant?: Record<string, string>;
    };

    const toKey = (e: { providerID: string; modelID: string }) => `${e.providerID}/${e.modelID}`;
    const favorites = [...new Set((data.favorite || []).map(toKey))];

    const providerSet = new Set<string>();
    for (const e of [...(data.favorite || []), ...(data.recent || [])]) {
      providerSet.add(e.providerID);
    }
    const connected = [...providerSet];

    const allSet = new Set<string>([
      ...favorites,
      ...(data.recent || []).map(toKey),
      ...Object.keys(data.variant || {})
    ]);
    const all = [...allSet];

    return { favorites, connected, all };
  } catch {
    return empty;
  }
}

const { schema: z } = tool;

const MEMORY_INSTRUCTIONS_DIR = "config/instructions";
const PLUGIN_INSTRUCTIONS_DIR = ".opencode/plugins/instructions";

// ============================================================================
// DEFAULT INSTRUCTION STRINGS (fallback when .md files are absent)
// ============================================================================

const DEFAULT_AGENTIC_SYSTEM = `<agentic-plugin>
[AGENTIC PLUGIN]
The \`agentic\` plugin provides tooling for building OpenCode-specific assets —
commands, plugins, and agents — for this project.

[AGENTIC BUILD COMMAND WORKFLOW]
Call \`agentic_build_command\` whenever the user's intent points toward building or
extending something in the OpenCode plugin stack — regardless of exact wording.

Trigger on explicit invocations (\`agentic_build_command\`, "build a command", "create
a tool") but also on intent signals like:
- "I want to add X to the plugin"
- "can we make a command that does Y"
- "how would I build Z in OpenCode"
- describing a workflow gap that a new command would fill
- asking what it would take to automate something in OpenCode

When in doubt, call the tool — it is cheap and the payload gives you everything
needed to start the conversation. Do not ask the user to rephrase or use the exact
tool name. It returns an \`INSTRUCTION_READY\` payload. When you receive it, follow
[AGENTIC_BUILD_COMMAND_INSTRUCTIONS].

[AGENTIC AUDIT SKILL WORKFLOW]
Call \`agentic_audit_skill\` whenever the user's intent points toward understanding,
reviewing, or debugging a Claude Code plugin or skill — regardless of exact wording.

Trigger on explicit invocations (\`agentic_audit_skill\`, "audit this plugin",
"review the save skill") but also on intent signals like:
- "what does {skill} actually do"
- "something seems off with {plugin}:{skill}"
- "look at the pmm plugin"
- "can you check if this skill is correct"
- "I think there's a bug in {skill}"
- "walk me through how {skill} works"

When in doubt, call the tool — infer \`plugin\` and \`skill\` from context; call
without args only when genuinely ambiguous. It returns a payload. When you receive
it, follow [AGENTIC_AUDIT_SKILL_INSTRUCTIONS].

[AGENTIC PORT SKILL WORKFLOW]
Call \`agentic_port_skill\` whenever the user's intent is to bring a Claude Code skill
or its equivalent behaviour into the OpenCode plugin stack.

Trigger on explicit invocations (\`agentic_port_skill\`, "port X skill") but also on
intent signals like:
- "make an OpenCode version of {skill}"
- "I want OpenCode to do what {plugin}:{skill} does"
- "convert the {skill} command to OpenCode"
- "add {skill} to the OpenCode plugin"
- "we have this in Claude Code, can we get it in OpenCode?"

Infer \`plugin\` and \`skill\` from context before calling. Both are required — if
either cannot be determined, ask the user before calling. It returns a payload.
When you receive it, follow [AGENTIC_PORT_SKILL_INSTRUCTIONS].

[AGENTIC MODEL WORKFLOW]
Call \`agentic_model\` whenever the user wants to change, query, or remove an agent's model in OpenCode.

Trigger on explicit invocations (\`agentic_model\`, "change model", "set model") but also on intent signals like:
- "run {agent} on {model}"
- "deploy {agent} on kimi / codex / gemini / gpt"
- "switch {agent} to {model}"
- "what model is {agent} running on"
- "remove the model override for {agent}"
- "configure {agent}'s model"
- any request to change which LLM an agent uses

When in doubt, call the tool — it reads the user's actual available models and resolves fuzzy names mechanically. Do NOT manually edit agent frontmatter or settings files. It returns a payload. When you receive it, follow [AGENTIC_MODEL_INSTRUCTIONS].
</agentic-plugin>`;

const DEFAULT_AGENTIC_BUILD_COMMAND = `# Agentic Build Command

You have received an \`INSTRUCTION_READY\` payload from \`agentic_build_command\`.
Your job is to collaborate with the user to design and build a well-specified
OpenCode plugin command.

## Collaboration Philosophy

This is a human-LLM collaboration — not an automated pipeline. Read the user and
adapt. Tone, pacing, depth, and question style should match what they bring in.
Someone with a half-formed idea needs space to think; someone with a detailed brief
needs focused confirmation. Own the conversational choices throughout. No mechanical
checklists, no robotic step-by-step narration. Move when you have enough; ask when
it matters.

## Understand the Runtime First

Before designing anything, develop a working understanding of the OpenCode plugin
system in the context of this project:

- Read the existing plugin files listed in the payload (\`existingPlugins\`) to
  understand the patterns already in use: hook types, tool factory usage, Zod arg
  schemas, INSTRUCTION_READY response shape, system context injection.
- Refer to https://opencode.ai/docs/plugins/ for the canonical hook and tool API.
- If the command involves integrating with an external service, domain pattern, or
  technology you are not certain about, use a web search to close that gap.

This groundwork informs the whole design. Don't skip it.

## Spec Process

Gather what you need to design the command well:

- **Purpose**: what problem does this solve? When would the user invoke it?
- **Arguments**: what does the user pass in? What is optional vs. required?
- **Expected output**: what does the tool return? What does the LLM do with it?
- **Edge cases**: what can go wrong? What should be returned when it does?
- **Expected invocation results**: concrete happy-path experience; concrete error-path.

Use judgment on how to elicit this. If the requirements payload has enough, confirm
and proceed. If not, ask — keep it focused. One well-aimed question beats a form.

## File Placement Decision

As part of spec, decide where the new command lives. The default is a new plugin
file — clean, well-scoped, no risk of affecting existing commands.

If the user wants to add to an existing plugin file, read and fully understand that
plugin's surface area first: all commands, helpers, shared state, hooks, and any
coupling between them. Only then propose where the command fits and surface any
integration concerns.

## Refactor Guard

If adding to an existing plugin file requires refactoring it, that requires
explicit, informed user consent. Before any refactor proceeds, tell the user:

- Why the refactor is needed
- Which other commands in that file are affected
- What the risks are (behavior changes, regressions, load-order effects)

Raise this in both the spec phase and again if it resurfaces during implementation.
Minimum viable change only — no opportunistic improvements.

## Spec Confirmation

Before writing any code, surface what you understood and what you plan to build.
This is a natural check-in, not a formal gate. The form is your call — paragraph,
short list, whatever fits the conversation. The user corrects or confirms; then you
proceed.

## Smoke Test

Define at least one concrete invocation scenario before calling the command done:

- Inputs (args passed to the tool)
- Expected output JSON from \`execute()\`
- What the LLM should do with that output

Validate the command logic against this scenario. How you frame it is your call.

## Plugin Conventions for This Project

- **Tool factory**: \`tool({ description, args, execute })\` from \`@opencode-ai/plugin\`
- **Args**: Zod schema via \`z.string()\`, \`z.enum()\`, \`.optional()\`, \`.describe()\`
- **execute() is thin**: gather context, return an INSTRUCTION_READY JSON payload —
  the LLM handles the substantive work, not the function
- **Instruction file pairing**: every non-trivial command has a paired instruction
  file at \`.opencode/plugins/instructions/{plugin}-{command}.md\`
- **Override system**: \`config/instructions/\` → \`.opencode/plugins/instructions/\`
  → hardcoded DEFAULT_* string in the plugin file
- **Tool naming**: \`{plugin}_{command}\` (e.g. \`agentic_build_command\`, \`vera_btw\`)
- **Instruction file naming**: \`{plugin}-{command}.md\`
- **System context injection**: new commands should be surfaced in the plugin's
  \`experimental.chat.system.transform\` hook so the LLM knows they exist
- **No filesystem writes in execute()** unless strictly necessary to surface context
  (reading files to populate the payload is fine)

## Output Deliverables

When spec is confirmed and the design is solid:

1. TypeScript tool definition — ready to insert into the target plugin file
2. Paired instruction \`.md\` file — complete and ready to write to
   \`.opencode/plugins/instructions/\`
3. System context snippet — for \`agentic-system.md\` (or the relevant plugin's
   system file) describing the new tool and its invocation trigger
4. Optionally: a stub entry for a \`plugin_info\` tool if the target plugin has one

Present these clearly so the user can review before anything is written to disk.`;

const DEFAULT_AGENTIC_AUDIT_SKILL = `# Agentic Audit Skill

You have received a payload from \`agentic_audit_skill\`. Act on it based on
its \`status\` field:

## PLUGIN_DISCOVERY

No plugin could be inferred from context. The payload contains \`availablePlugins\` —
a list of all plugins findable from this project (harness + global cache). Present
the list to the user and ask which plugin they want to audit. Once they answer, call
\`agentic_audit_skill\` again with \`plugin\` set to their choice.

## INSTRUCTION_READY

You have received the full content of a Claude Code plugin. Produce a comprehensive
audit covering all 12 dimensions below.

Cover all of the following for the plugin as a whole (or the specified skill if
\`skillFilter\` is set). When a dimension cannot be determined from the content alone,
ask the user — don't speculate.

1. **Purpose & intent** — What problem does this plugin/skill solve? Who uses it?
2. **Contract** — Arguments, invocation modes, triggers, and expected outcomes.
3. **Communication style** — How does it talk to the user? Tone, verbosity, format.
4. **Response patterns** — What it returns, in what format. Edge cases and fallbacks.
5. **End-to-end process** — Step-by-step workflow from invocation to completion.
6. **Instruction content** — What the SKILL.md says. Are the instructions clear, complete, unambiguous?
7. **Dependencies** — Other skills invoked, memory files read/written, git operations, tools called, external services.
8. **Lifecycle** — When is it invoked? Session-persistent vs. one-shot? Hook bindings?
9. **Skill interactions** — What does it call? What calls it?
10. **Resources & files** — What it reads, writes, creates, or deletes. Side effects.
11. **Settings & configuration** — What's configurable? What uses defaults?
12. **Permissions model** — What access does it require? Any security-relevant operations?

## Bug & Flaw Surfacing

For each issue found, assign a severity tier:

- **CRITICAL** — Makes the skill non-functional. Broken preconditions, missing required steps, unreachable states.
- **WARNING** — Ambiguous instructions, edge case risk, missing validation, implicit assumptions that could break under realistic conditions.
- **NOTE** — Style issues, incomplete coverage, minor gaps that don't affect correctness.

Do not propose fixes unless the user explicitly asks. Surface the issue, explain
the concern, and cite the specific content that causes it.

## Clarification Questions

When something cannot be determined from the content alone — intended behavior for
an ambiguous path, an undocumented dependency, an implicit assumption — ask the
user. Keep questions focused and purposeful.

## Cross-Skill Depth

If a skill invokes other skills, note the dependency and what you observe about the
interaction. Do not recursively audit sibling skills unless the user asks. Reference
them by name from \`siblingSkillNames\` in the payload.

## Spec Deliverable

When all dimensions are covered: produce a structured narrative spec document
covering everything above. Form is yours — adapt it to what's in the plugin and
what the user needs.

At the end, explicitly seek user concurrence: confirm the audit is complete, flag
anything left unresolvable without more information, and ask if they want fixes or
changes proposed.`;

const DEFAULT_AGENTIC_PORT_SKILL = `# Agentic Port Skill

You have received an \`INSTRUCTION_READY\` payload from \`agentic_port_skill\`.
Your job is to translate a Claude Code skill into an equivalent OpenCode plugin
command, then build it. Two phases: understand first, build second.

## Phase 1: Understand the Skill

Develop a thorough understanding of the skill before designing its equivalent.
Use the audit dimensions — focused on "what does it do" rather than bug hunting:

1. **Purpose & intent** — what problem does this solve? who uses it?
2. **Contract** — args, invocation modes, triggers, preconditions, outcomes
3. **Communication style** — tone, verbosity, format
4. **Response patterns** — what it returns, error handling, edge cases
5. **End-to-end process** — step-by-step workflow
6. **Instruction content** — what the SKILL.md says, gaps, ambiguities
7. **Dependencies** — other skills, memory files, tools, external services
8. **Lifecycle** — session vs. one-shot, hook bindings (\`hooksJson\`)
9. **Skill interactions** — what it calls, what calls it (see \`siblingSkillNames\`)
10. **Resources & files** — reads, writes, side effects
11. **Settings & configuration** — what's configurable
12. **Permissions** — access requirements, security-relevant operations

Ask the user when something cannot be determined from the content alone.

Summarise your understanding before proceeding to Phase 2 — confirm with the user
that you have the skill right before you start designing its OpenCode equivalent.

## Phase 2: Choose Target & Translate

Start Phase 2 by choosing the OpenCode target for this skill. Three options:

**A. OpenCode Skill** — if the skill is primarily instruction text, invoked
on-demand by the main agent, and needs no context gathering at call time. No
TypeScript, no plugin required. Format:

\`\`\`markdown
---
name: skill-name          # required: use existing dir name (from payload skill key)
description: One-sentence summary — 1–1024 chars.
---

<instruction content here>
\`\`\`

Place at \`.opencode/skills/<name>/SKILL.md\`. The agent discovers it automatically
from \`.opencode/skills/\` (or global equivalents) and loads it via the native
\`skill\` tool. Check \`existingSkills\` in the payload for name conflicts.

**B. OpenCode Agent** — if the skill defines a persona, a distinct role, or
different tool permissions; or should run as a subagent invokable via \`@mention\`
or the Task tool. Format:

\`\`\`markdown
---
description: What this agent does and when to invoke it.
mode: subagent             # primary | subagent | all
model: claude-sonnet-4-5  # optional — override per-agent
tools:                     # optional — allowlist
  - read
  - edit
permissions:               # optional — fine-grained
  internal: deny
  bash:
    allow: []
    deny: []
---

<agent system prompt here>
\`\`\`

Place at \`.opencode/agents/<name>.md\`. Subagents are called by other agents;
primary agents are the main interface. Check \`existingAgents\` in the payload
for name conflicts.

**C. Plugin Command** — if the skill needs to read files, gather structured
context, or build a payload before the LLM acts. This is the standard path for
skills with meaningful \`execute()\` logic.

Confirm the target type with the user before designing the port.

---

Map the skill to the chosen target. For plugin commands, decide element by element:

- **Invocation** — Claude Code skills are CLI slash-commands (\`pmm:save\`). The
  OpenCode equivalent is a tool (\`pmm_save\`). What args does it take?
- **Instruction content** — SKILL.md content becomes the paired instruction file at
  \`.opencode/plugins/instructions/{plugin}-{command}.md\`
- **Context & references** — inform the instruction file and system context snippet;
  surface any key reference material the LLM will need at runtime
- **Hooks** — \`hooksJson\` may have equivalents via \`experimental.chat.system.transform\`
  or other hooks. Identify what carries over and what doesn't.
- **Dependencies** — skills that invoke sibling skills may require those to exist
  first in OpenCode. Surface as a dependency note, not a blocker.
- **Side effects** — decide what stays in \`execute()\` (thin: gather context only)
  vs. what the LLM handles. The OpenCode execute() should not perform writes.

## Agent & Bot Skills

If the skill uses agent dispatch, bot stamping, or subagent coordination — detect
this from the skill content before designing anything. Signals:
\`vera:bot\`, \`vera:task\`, \`vera:sprint\`, \`@agent\`, \`run_in_background\`,
bot YAML front-matter, template variables like \`{{memory_root}}\`.

Then look at \`vera.ts\` in \`existingPlugins\` — it contains \`loadAgentDispatchContext()\`,
the canonical OpenCode pattern for this. Study it before designing the port.

When the bot/agent is a stable persona with its own role and permissions that should
be reusable, prefer **target B (OpenCode Agent)**. When the bot is assembled
dynamically at call time from a runtime-resolved context, prefer **target C
(Plugin Command)** with \`execute()\` that reads the agent context.

Apply these translation mappings:

- **Bot stamping / agent dispatch** — \`execute()\` reads the target agent's \`AGENTS.md\`
  or \`CLAUDE.md\` (persona) plus session instructions, returns both in the payload.
  The main LLM executes inline, impersonating the agent using that context. No
  subagent is spawned. If the skill references named agents, check the payload's
  \`contextFiles\` and \`references\` for any roster or config included in the plugin
  itself — do not assume a project-specific memory structure.

- **Bot template variables** (\`{{memory_root}}\`, \`{{model}}\`, \`{{git_author}}\`) —
  resolve at \`execute()\` call time from available context (worktree, env, memory
  files), inject as concrete values in the payload.

- **Background/parallel execution** (\`run_in_background: true\`, multi-wave sprints)
  — OpenCode runs sequentially; the main LLM orchestrates what Claude Code would
  parallelise. Note the serialisation in the instruction file. Ask the user whether
  execution order matters for correctness.

- **Bot model selection** (\`--model haiku\`) — no direct OpenCode equivalent in
  \`execute()\`. Note it in translation notes as informational; the instruction file
  can mention it as a hint but it does not affect tool design.

Firm non-translatables — flag these explicitly and agree with the user before proceeding:
- **Isolated context per agent** — OpenCode has no context scoping between agents;
  all reads happen in the shared session. Skills that depend on context isolation
  (e.g., keeping agent A unaware of agent B's state) cannot be replicated.
- **Per-agent compaction** — each Claude Code agent maintains separate context across
  compaction boundaries. No equivalent in OpenCode.
- **True async background** — bots that run and return results asynchronously after
  the main conversation continues. Not possible; the tool call blocks.

- **What else doesn't translate** — any other Claude Code behaviours with no OpenCode
  equivalent (CLI-only flows, missing hook types). Flag and agree on skip/adapt/defer.

Present the translation plan before writing any code. Give the user a chance to
adjust scope, skip non-translatable parts, or change the design.

## Phase 3: Build

Once the translation plan is confirmed, follow the appropriate build workflow based
on the chosen target:

**Target A (OpenCode Skill):** Write the SKILL.md with valid frontmatter. No
TypeScript or plugin file needed. The \`name\` field must match the directory name
exactly. No system context snippet required — skills are instruction-only.

**Target B (OpenCode Agent):** Write the \`.opencode/agents/<name>.md\` with valid
frontmatter. Set \`mode: subagent\` unless it replaces the main interface. Add any
tool restrictions or model overrides only if clearly needed. No TypeScript required.
Include a system context snippet if this agent should appear in the parent plugin's
system file as a callable resource.

**Target C (Plugin Command):** Invoke \`agentic_build_command\` with the translation
plan as the \`requirements\` argument. Hand off the full design — tool name, args,
execute() context-gathering logic, instruction file content, and system context
snippet — as the requirements text. \`agentic_build_command\` will run its own
iterative spec-and-build workflow from there.

## Output Deliverables

One of three output variants depending on the chosen target:

**A — OpenCode Skill:**
1. \`SKILL.md\` — complete, ready to write to \`.opencode/skills/<name>/SKILL.md\`
2. Translation notes — what didn't map, deferred items, anything the user should know

**B — OpenCode Agent:**
1. Agent \`.md\` file — complete, ready to write to \`.opencode/agents/<name>.md\`
2. System context snippet — if the agent should appear in a parent plugin's system file
3. Translation notes — non-translatable parts, permissions rationale, model choice

**C — Plugin Command:**
1. TypeScript tool definition — ready to insert into the target plugin file
2. Paired instruction \`.md\` file — complete, ready to write
3. System context snippet — for the relevant plugin's system file
4. Translation notes — non-translatable parts, deferred dependencies, renamed
   concepts, anything the user should know before shipping`;

// ============================================================================
// HELPERS
// ============================================================================

function getRoot(context: { directory?: string }, fallback?: string): string {
  return fallback || context?.directory || process.cwd();
}

function resolveInstructionPath(root: string, name: string): string | null {
  const memPath = join(root, MEMORY_INSTRUCTIONS_DIR, `${name}.md`);
  if (existsSync(memPath)) return memPath;

  const plugPath = join(root, PLUGIN_INSTRUCTIONS_DIR, `${name}.md`);
  if (existsSync(plugPath)) return plugPath;

  return null;
}

function loadInstruction(root: string, name: string, defaultValue: string): string {
  const path = resolveInstructionPath(root, name);
  if (!path) return defaultValue;
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return defaultValue;
  }
}

function listPluginFiles(root: string): string[] {
  const pluginsDir = join(root, ".opencode", "plugins");
  if (!existsSync(pluginsDir)) return [];
  try {
    return readdirSync(pluginsDir)
      .filter((f) => f.endsWith(".ts") && !f.startsWith("."))
      .sort();
  } catch {
    return [];
  }
}

function listOpenCodeSkills(root: string): string[] {
  const skillsDir = join(root, ".opencode", "skills");
  if (!existsSync(skillsDir)) return [];
  try {
    return readdirSync(skillsDir)
      .filter((f) => existsSync(join(skillsDir, f, "SKILL.md")))
      .sort();
  } catch {
    return [];
  }
}

function listOpenCodeAgents(root: string): string[] {
  const agentsDir = join(root, ".opencode", "agents");
  if (!existsSync(agentsDir)) return [];
  try {
    return readdirSync(agentsDir)
      .filter((f) => f.endsWith(".md") && !f.startsWith("."))
      .map((f) => f.replace(/\.md$/, ""))
      .sort();
  } catch {
    return [];
  }
}

function readFileSafe(filePath: string): string | null {
  if (!existsSync(filePath)) return null;
  try {
    return readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

function readDirMd(dir: string): { name: string; content: string }[] {
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .map((f) => ({ name: f, content: readFileSafe(join(dir, f)) ?? "" }))
      .filter((f) => f.content !== "");
  } catch {
    return [];
  }
}

function listSkillNames(pluginDir: string): string[] {
  const names = new Set<string>();
  for (const subdir of ["skills", "local"]) {
    const dir = join(pluginDir, subdir);
    if (!existsSync(dir)) continue;
    try {
      for (const entry of readdirSync(dir)) {
        if (existsSync(join(dir, entry, "SKILL.md"))) names.add(entry);
      }
    } catch {
      // ignore
    }
  }
  return Array.from(names).sort();
}

function readSkills(
  pluginDir: string,
  skillFilter?: string
): { name: string; content: string; location: string }[] {
  // Collect from skills/ then local/ — skills/ takes precedence for same name
  const seen = new Map<string, { name: string; content: string; location: string }>();

  for (const subdir of ["skills", "local"]) {
    const dir = join(pluginDir, subdir);
    if (!existsSync(dir)) continue;
    try {
      for (const skillName of readdirSync(dir)) {
        if (skillFilter && skillName !== skillFilter) continue;
        if (seen.has(skillName)) continue; // skills/ already found it
        const content = readFileSafe(join(dir, skillName, "SKILL.md"));
        if (content !== null) seen.set(skillName, { name: skillName, content, location: subdir });
      }
    } catch {
      // ignore
    }
  }

  return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function resolvePluginDir(nameOrPath: string, root: string): string | null {
  // Absolute path — use directly
  if (nameOrPath.startsWith("/")) {
    return existsSync(nameOrPath) ? nameOrPath : null;
  }

  // Relative path — resolve from project root
  if (nameOrPath.startsWith("./") || nameOrPath.startsWith("../")) {
    const resolved = join(root, nameOrPath);
    return existsSync(resolved) ? resolved : null;
  }

  // Name-based: check harness first
  const harnessBase = join(root, "agentic-harness-dev", "agentic-harness", "claudecode");
  const withSuffix = join(harnessBase, `${nameOrPath}-plugin`);
  if (existsSync(join(withSuffix, ".claude-plugin", "plugin.json"))) return withSuffix;

  const withoutSuffix = join(harnessBase, nameOrPath);
  if (existsSync(join(withoutSuffix, ".claude-plugin", "plugin.json"))) return withoutSuffix;

  // Name-based: scan global plugin cache
  const cacheRoot = join(homedir(), ".claude", "plugins", "cache");
  if (existsSync(cacheRoot)) {
    let bestPath: string | null = null;
    let bestVersion = "";
    try {
      for (const marketplace of readdirSync(cacheRoot)) {
        const pluginVersionsDir = join(cacheRoot, marketplace, nameOrPath);
        if (!existsSync(pluginVersionsDir)) continue;
        const versions = readdirSync(pluginVersionsDir).sort();
        if (versions.length === 0) continue;
        const latest = versions[versions.length - 1];
        if (!bestVersion || latest > bestVersion) {
          bestVersion = latest;
          bestPath = join(pluginVersionsDir, latest);
        }
      }
    } catch {
      // ignore
    }
    if (bestPath) return bestPath;
  }

  return null;
}

type PluginEntry = { name: string; path: string; source: "harness" | "cache"; version?: string };

function listAvailablePlugins(root: string): PluginEntry[] {
  const results: PluginEntry[] = [];

  // Harness plugins
  const harnessBase = join(root, "agentic-harness-dev", "agentic-harness", "claudecode");
  if (existsSync(harnessBase)) {
    try {
      for (const entry of readdirSync(harnessBase)) {
        const entryPath = join(harnessBase, entry);
        if (existsSync(join(entryPath, ".claude-plugin", "plugin.json"))) {
          const name = entry.endsWith("-plugin") ? entry.slice(0, -7) : entry;
          results.push({ name, path: entryPath, source: "harness" });
        }
      }
    } catch {
      // ignore
    }
  }

  // Global cache — deduplicate by plugin name, keep latest version
  const cacheRoot = join(homedir(), ".claude", "plugins", "cache");
  const cacheSeen = new Map<string, PluginEntry>();
  if (existsSync(cacheRoot)) {
    try {
      for (const marketplace of readdirSync(cacheRoot)) {
        const marketplaceDir = join(cacheRoot, marketplace);
        for (const pluginName of readdirSync(marketplaceDir)) {
          const versionsDir = join(marketplaceDir, pluginName);
          const versions = readdirSync(versionsDir).sort();
          if (versions.length === 0) continue;
          const latest = versions[versions.length - 1];
          const entryPath = join(versionsDir, latest);
          const existing = cacheSeen.get(pluginName);
          if (!existing || latest > (existing.version ?? "")) {
            cacheSeen.set(pluginName, { name: pluginName, path: entryPath, source: "cache", version: latest });
          }
        }
      }
    } catch {
      // ignore
    }
  }

  // Add cache entries that aren't already in harness
  const harnessNames = new Set(results.map((e) => e.name));
  for (const entry of cacheSeen.values()) {
    if (!harnessNames.has(entry.name)) results.push(entry);
  }

  return results.sort((a, b) => a.name.localeCompare(b.name));
}

// ============================================================================
// PLUGIN EXPORT
// ============================================================================


export const AgenticPlugin: Plugin = async ({ worktree: pluginWorktree }) => {
  return {
    "experimental.chat.system.transform": async (_input, output) => {
      const root = pluginWorktree || process.cwd();

      const systemInstructions = loadInstruction(root, "agentic-system", DEFAULT_AGENTIC_SYSTEM);
      const buildCommandInstructions = loadInstruction(root, "agentic-build-command", DEFAULT_AGENTIC_BUILD_COMMAND);
      const auditSkillInstructions = loadInstruction(root, "agentic-audit-skill", DEFAULT_AGENTIC_AUDIT_SKILL);
      const portSkillInstructions = loadInstruction(root, "agentic-port-skill", DEFAULT_AGENTIC_PORT_SKILL);
      const modelInstructions = loadInstruction(root, "agentic-model", "");

      const injected = [
        "[AGENTIC_SYSTEM]",
        systemInstructions,
        "",
        "[AGENTIC_BUILD_COMMAND_INSTRUCTIONS]",
        buildCommandInstructions,
        "",
        "[AGENTIC_AUDIT_SKILL_INSTRUCTIONS]",
        auditSkillInstructions,
        "",
        "[AGENTIC_PORT_SKILL_INSTRUCTIONS]",
        portSkillInstructions,
        "",
        "[AGENTIC_MODEL_INSTRUCTIONS]",
        modelInstructions,
      ].join("\n");

      output.system.push(injected);
    },

    tool: {
      agentic_audit_skill: tool({
        description:
          "Load all content of a Claude Code plugin or standalone skill (SKILL.md, plugin.json, context, references, hooks) and return it as an INSTRUCTION_READY payload for structured auditing. Reads from the project harness, global plugin cache, or any path. Supports full-plugin audits and single-skill focus.",
        args: {
          plugin: z
            .string()
            .optional()
            .describe(
              "Plugin name (e.g. 'pmm', 'vera') or absolute/relative path to the plugin root directory. Resolved from the project harness, then the global ~/.claude/plugins/cache."
            ),
          skill: z
            .string()
            .optional()
            .describe(
              "Narrow the audit to a single skill by name (e.g. 'save'). Omit to include all skills."
            ),
        },
        execute: async (
          args: { plugin?: string; skill?: string },
          context: { directory?: string }
        ) => {
          const root = getRoot(context, pluginWorktree);

          if (!args.plugin) {
            const available = listAvailablePlugins(root);
            return JSON.stringify({
              status: "PLUGIN_DISCOVERY",
              plugin: "agentic",
              tool: "agentic_audit_skill",
              message: "No plugin specified. Here are the available plugins — ask the user which one to audit.",
              availablePlugins: available.map((e) => ({
                name: e.name,
                source: e.source,
                version: e.version ?? null,
                path: e.path,
              })),
            });
          }

          const pluginDir = resolvePluginDir(args.plugin, root);
          if (!pluginDir) {
            return JSON.stringify({
              status: "ERROR",
              plugin: "agentic",
              tool: "agentic_audit_skill",
              message: `Could not resolve plugin: ${args.plugin}. Checked project harness and global cache.`,
            });
          }

          // Standalone skill: if the resolved path itself contains a SKILL.md,
          // treat it as a single-skill audit (no plugin.json context needed)
          const standaloneSkillMd = readFileSafe(join(pluginDir, "SKILL.md"));
          if (standaloneSkillMd !== null) {
            const skillName = pluginDir.split("/").pop() ?? args.plugin;
            return JSON.stringify({
              status: "INSTRUCTION_READY",
              instruction_key: "AGENTIC_AUDIT_SKILL_INSTRUCTIONS",
              plugin: "agentic",
              tool: "agentic_audit_skill",
              resolvedPlugin: args.plugin,
              resolvedPath: pluginDir,
              standalone: true,
              skillFilter: skillName,
              pluginJson: null,
              siblingSkillNames: [],
              skills: [{ name: skillName, content: standaloneSkillMd, location: "standalone" }],
              contextFiles: readDirMd(join(pluginDir, "context")),
              references: readDirMd(join(pluginDir, "references")),
              hooksJson: null,
            });
          }

          // Plugin manifest
          const manifestRaw = readFileSafe(join(pluginDir, ".claude-plugin", "plugin.json"));
          let pluginJson: unknown = null;
          if (manifestRaw) {
            try {
              pluginJson = JSON.parse(manifestRaw);
            } catch {
              pluginJson = { raw: manifestRaw, parseError: true };
            }
          }

          // Skills
          const skills = readSkills(pluginDir, args.skill);
          if (args.skill && skills.length === 0) {
            return JSON.stringify({
              status: "ERROR",
              plugin: "agentic",
              tool: "agentic_audit_skill",
              message: `Skill '${args.skill}' not found in plugin '${args.plugin}' at ${pluginDir}.`,
              availableSkills: listSkillNames(pluginDir),
            });
          }

          // Context, references
          const contextFiles = readDirMd(join(pluginDir, "context"));
          const references = readDirMd(join(pluginDir, "references"));

          // Hooks
          const hooksRaw = readFileSafe(join(pluginDir, "hooks", "hooks.json"));
          let hooksJson: unknown = null;
          if (hooksRaw) {
            try {
              hooksJson = JSON.parse(hooksRaw);
            } catch {
              hooksJson = { raw: hooksRaw, parseError: true };
            }
          }

          return JSON.stringify({
            status: "INSTRUCTION_READY",
            instruction_key: "AGENTIC_AUDIT_SKILL_INSTRUCTIONS",
            plugin: "agentic",
            tool: "agentic_audit_skill",
            resolvedPlugin: args.plugin,
            resolvedPath: pluginDir,
            skillFilter: args.skill ?? null,
            pluginJson,
            siblingSkillNames: listSkillNames(pluginDir),
            skills,
            contextFiles,
            references,
            hooksJson,
          });
        },
      }),

      agentic_port_skill: tool({
        description:
          "Port a Claude Code skill to an equivalent OpenCode plugin command. Loads the skill content (audit_skill phase), then guides a full translation and build process (build_command phase). Both `plugin` and `skill` are required — infer from context or ask the user before calling.",
        args: {
          plugin: z
            .string()
            .describe(
              "Plugin name (e.g. 'pmm', 'vera') or absolute/relative path to the plugin root directory."
            ),
          skill: z
            .string()
            .describe(
              "Skill name to port (e.g. 'save'). Always one skill at a time."
            ),
        },
        execute: async (
          args: { plugin: string; skill: string },
          context: { directory?: string }
        ) => {
          const root = getRoot(context, pluginWorktree);

          const pluginDir = resolvePluginDir(args.plugin, root);
          if (!pluginDir) {
            return JSON.stringify({
              status: "ERROR",
              plugin: "agentic",
              tool: "agentic_port_skill",
              message: `Could not resolve plugin: ${args.plugin}. Checked project harness and global cache.`,
            });
          }

          // Skill content — required
          const skills = readSkills(pluginDir, args.skill);
          if (skills.length === 0) {
            return JSON.stringify({
              status: "ERROR",
              plugin: "agentic",
              tool: "agentic_port_skill",
              message: `Skill '${args.skill}' not found in plugin '${args.plugin}' at ${pluginDir}.`,
              availableSkills: listSkillNames(pluginDir),
            });
          }

          // Plugin manifest
          const manifestRaw = readFileSafe(join(pluginDir, ".claude-plugin", "plugin.json"));
          let pluginJson: unknown = null;
          if (manifestRaw) {
            try {
              pluginJson = JSON.parse(manifestRaw);
            } catch {
              pluginJson = { raw: manifestRaw, parseError: true };
            }
          }

          // Context, references, hooks
          const contextFiles = readDirMd(join(pluginDir, "context"));
          const references = readDirMd(join(pluginDir, "references"));
          const hooksRaw = readFileSafe(join(pluginDir, "hooks", "hooks.json"));
          let hooksJson: unknown = null;
          if (hooksRaw) {
            try {
              hooksJson = JSON.parse(hooksRaw);
            } catch {
              hooksJson = { raw: hooksRaw, parseError: true };
            }
          }

          // OpenCode plugin context (for the build phase)
          const existingPlugins = listPluginFiles(root);
          const existingSkills = listOpenCodeSkills(root);
          const existingAgents = listOpenCodeAgents(root);

          return JSON.stringify({
            status: "INSTRUCTION_READY",
            instruction_key: "AGENTIC_PORT_SKILL_INSTRUCTIONS",
            plugin: "agentic",
            tool: "agentic_port_skill",
            // Source skill
            resolvedPlugin: args.plugin,
            resolvedPath: pluginDir,
            skillFilter: args.skill,
            pluginJson,
            siblingSkillNames: listSkillNames(pluginDir),
            skills,
            contextFiles,
            references,
            hooksJson,
            // OpenCode build context
            projectRoot: root,
            instructionsDir: join(root, PLUGIN_INSTRUCTIONS_DIR),
            existingPlugins,
            existingSkills,
            existingAgents,
          });
        },
      }),

      agentic_model: tool({
        description: "Set, query, or remove an OC agent's model. Reads available models from OC's local state, resolves fuzzy hints against favorites and connected providers, stamps the exact provider/model into agent frontmatter.",
        args: {
          agent: z.string().describe("Agent handle or filename (e.g. 'leith', 'leith.md')."),
          model: z.string().optional().describe("Model hint (e.g. 'kimi', 'codex', 'gpt'), exact 'provider/model', or 'none'/'remove' to clear.")
        },
        execute: async (
          args: { agent: string; model?: string },
          context: { directory?: string }
        ) => {
          const root = context?.directory || process.cwd();
          const handle = args.agent.replace(/\.md$/, "").toLowerCase();
          const agentFile = `.opencode/agents/${handle}.md`;
          const agentPath = join(root, agentFile);

          if (!existsSync(agentPath)) {
            return JSON.stringify({
              status: "ERROR",
              plugin: "agentic",
              tool: "agentic_model",
              message: `Agent file not found: ${agentFile}. Create it first or check the handle.`
            });
          }

          const content = readFileSync(agentPath, "utf-8");
          const currentModelMatch = content.match(/^model:\s*(.+)$/m);
          const currentModel = currentModelMatch ? currentModelMatch[1].trim() : null;

          const modelState = loadOcModelState();

          // Load instruction
          const instructionPath = join(root, PLUGIN_INSTRUCTIONS_DIR, "agentic-model.md");
          const configInstructionPath = join(root, MEMORY_INSTRUCTIONS_DIR, "agentic-model.md");
          const instruction = existsSync(configInstructionPath)
            ? readFileSync(configInstructionPath, "utf-8")
            : existsSync(instructionPath)
              ? readFileSync(instructionPath, "utf-8")
              : "";

          // No model arg — query mode
          if (!args.model) {
            return JSON.stringify({
              status: "OK",
              plugin: "agentic",
              tool: "agentic_model",
              instruction,
              agent: handle,
              agentFile,
              currentModel,
              models: modelState
            });
          }

          // Remove model
          if (args.model.toLowerCase() === "none" || args.model.toLowerCase() === "remove") {
            if (currentModel) {
              const updated = content.replace(/^model:.*\n?/m, "");
              writeFileSync(agentPath, updated, "utf-8");
            }
            return JSON.stringify({
              status: "REMOVED",
              plugin: "agentic",
              tool: "agentic_model",
              instruction,
              agent: handle,
              agentFile,
              previousModel: currentModel,
              models: modelState
            });
          }

          // Model resolution
          const query = args.model.toLowerCase();

          // Exact match first
          const exactMatch = modelState.all.find((m) => m.toLowerCase() === query);
          if (exactMatch) {
            const updated = currentModel
              ? content.replace(/^model:.*$/m, `model: ${exactMatch}`)
              : content.replace(/^(mode:.*)$/m, `$1\nmodel: ${exactMatch}`);
            writeFileSync(agentPath, updated, "utf-8");
            return JSON.stringify({
              status: "RESOLVED",
              plugin: "agentic",
              tool: "agentic_model",
              instruction,
              agent: handle,
              agentFile,
              previousModel: currentModel,
              newModel: exactMatch,
              models: modelState
            });
          }

          // Fuzzy match — search favorites + connected providers first
          const connectedModels = modelState.all.filter((m) =>
            modelState.connected.includes(m.split("/")[0])
          );
          const matches = connectedModels.filter((m) => m.toLowerCase().includes(query));

          if (matches.length === 1) {
            const match = matches[0];
            const updated = currentModel
              ? content.replace(/^model:.*$/m, `model: ${match}`)
              : content.replace(/^(mode:.*)$/m, `$1\nmodel: ${match}`);
            writeFileSync(agentPath, updated, "utf-8");
            return JSON.stringify({
              status: "RESOLVED",
              plugin: "agentic",
              tool: "agentic_model",
              instruction,
              agent: handle,
              agentFile,
              previousModel: currentModel,
              newModel: match,
              models: modelState
            });
          }

          if (matches.length > 1) {
            // Check if any are favorites — prioritize
            const favMatches = matches.filter((m) => modelState.favorites.includes(m));
            if (favMatches.length === 1) {
              const match = favMatches[0];
              const updated = currentModel
                ? content.replace(/^model:.*$/m, `model: ${match}`)
                : content.replace(/^(mode:.*)$/m, `$1\nmodel: ${match}`);
              writeFileSync(agentPath, updated, "utf-8");
              return JSON.stringify({
                status: "RESOLVED",
                plugin: "agentic",
                tool: "agentic_model",
                instruction,
                agent: handle,
                agentFile,
                previousModel: currentModel,
                newModel: match,
                note: "Resolved to favorite model.",
                models: modelState
              });
            }

            return JSON.stringify({
              status: "AMBIGUOUS",
              plugin: "agentic",
              tool: "agentic_model",
              instruction,
              agent: handle,
              agentFile,
              currentModel,
              query: args.model,
              matches,
              question: {
                header: "Model",
                question: `Multiple models match "${args.model}". Which one should ${handle} run on?`,
                options: matches.map((m) => ({
                  label: m,
                  description: modelState.favorites.includes(m) ? "★ favorite" : "connected"
                }))
              },
              models: modelState
            });
          }

          // Check unconnected providers
          const allMatches = modelState.all.filter((m) => m.toLowerCase().includes(query));
          if (allMatches.length > 0) {
            return JSON.stringify({
              status: "UNCONNECTED_PROVIDER",
              plugin: "agentic",
              tool: "agentic_model",
              instruction,
              agent: handle,
              agentFile,
              currentModel,
              query: args.model,
              matches: allMatches,
              warning: `Found matches but provider(s) may not be connected: ${allMatches.join(", ")}. Connected providers: ${modelState.connected.join(", ")}.`,
              models: modelState
            });
          }

          return JSON.stringify({
            status: "NO_MATCH",
            plugin: "agentic",
            tool: "agentic_model",
            instruction,
            agent: handle,
            agentFile,
            currentModel,
            query: args.model,
            models: modelState
          });
        }
      }),

      agentic_build_command: tool({
        description:
          "Collaboratively spec and build a new OpenCode plugin command. Accepts inline requirements or a path to a requirements file. Runs an iterative design process with the user — studying plugin anatomy, gathering spec, confirming design, and smoke testing before generating any code.",
        args: {
          requirements: z
            .string()
            .optional()
            .describe("Inline requirements for the new command. Can be rough or detailed."),
          prompt: z
            .string()
            .optional()
            .describe(
              "Path to a markdown file containing requirements. Merged with inline requirements if both are provided."
            ),
        },
        execute: async (
          args: { requirements?: string; prompt?: string },
          context: { directory?: string }
        ) => {
          const root = getRoot(context, pluginWorktree);

          let fileRequirements = "";
          if (args.prompt) {
            const promptPath = args.prompt.startsWith("/") ? args.prompt : join(root, args.prompt);

            if (!existsSync(promptPath)) {
              return JSON.stringify({
                status: "ERROR",
                plugin: "agentic",
                tool: "agentic_build_command",
                message: `Prompt file not found: ${promptPath}`,
              });
            }

            try {
              fileRequirements = readFileSync(promptPath, "utf-8");
            } catch {
              return JSON.stringify({
                status: "ERROR",
                plugin: "agentic",
                tool: "agentic_build_command",
                message: `Could not read prompt file: ${promptPath}`,
              });
            }
          }

          const parts = [fileRequirements, args.requirements ?? ""]
            .map((s) => s.trim())
            .filter(Boolean);
          const mergedRequirements = parts.join("\n\n---\n\n");

          const existingPlugins = listPluginFiles(root);

          return JSON.stringify({
            status: "INSTRUCTION_READY",
            instruction_key: "AGENTIC_BUILD_COMMAND_INSTRUCTIONS",
            plugin: "agentic",
            tool: "agentic_build_command",
            requirements: mergedRequirements || null,
            promptFile: args.prompt ?? null,
            projectRoot: root,
            instructionsDir: join(root, PLUGIN_INSTRUCTIONS_DIR),
            existingPlugins,
          });
        },
      }),
    },
  };
};
