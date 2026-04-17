---
name: agentic:build_command
description: "Spec and build a new OpenCode plugin command (TypeScript tool + paired instruction file) from scratch. Walks through a four-phase collaboration: study existing anatomy → spec the new command → confirm with user → write and smoke test. Use when the user asks to build, add, or create a new OpenCode tool or command."
argument-hint: "[command-name or description of what you want to build]"
---

# Agentic Build Command

Spec and build a new OpenCode plugin command. $ARGUMENTS is the name or a short
description of what the new command should do. If no arguments are given, ask the user.

## Step 0 — Fetch Reference Specs

Fetch the following before doing any analysis:

- **https://opencode.ai/docs/plugins/** — OC plugin system, tool() factory, Zod, hook events
- **https://opencode.ai/docs/skills/** — OC skill format and discovery paths
- **https://opencode.ai/docs/agents/** — OC agent frontmatter, modes, permissions

Read these before continuing. Do not rely on training-time knowledge about the OC plugin API.

## Step 1 — Understand the OC Runtime

Before speccing anything, study the existing anatomy by reading reference files:

**Read the existing plugin files:**
- Glob `.opencode/plugins/*.ts` to find all plugin files
- Read one or two existing plugin `.ts` files in full — preferably `agentic.ts` or `vera.ts`
  if they exist (these are purpose-built examples of OC plugin commands)
- Read their paired instruction `.md` files in `.opencode/plugins/instructions/`

From this study, document the following conventions before proceeding:

1. **Plugin file structure** — how `tool()` is registered, how the plugin exports tools
2. **Zod args schema** — how args are declared, required vs optional, `.describe()` usage
3. **execute() pattern** — how context is gathered, what helpers are used, what the return
   shape looks like (`status`, payload fields)
4. **Return convention** — `INSTRUCTION_READY` + JSON payload vs `ERROR` shape
5. **Instruction file convention** — file naming pattern (`<plugin>-<command>.md`), how
   payload fields are referenced in the instruction body, phase structure
6. **DEFAULT_* constants** — how fallback instruction content is embedded in the `.ts`
   file as a string constant
7. **System context injection** — `experimental.chat.system.transform` pattern if present

If anything is unclear from the files, note it and infer from the OC docs fetched in Step 0.

## Phase 2 — Spec the New Command

Now spec the new command through a structured conversation with the user.

Work through these questions — you may batch related ones, but do not skip any:

1. **Purpose** — What does this command do in one sentence? What problem does it solve?
   Who triggers it and under what circumstances?

2. **Arguments** — What does the user pass at invocation time? Which are required vs optional?
   What are acceptable values / formats? Are there smart defaults?

3. **Execute() context** — What does the command need to read before the LLM can help?
   - Which files should it Glob / Read?
   - Which environment values or settings should it inspect?
   - Any external calls or computed values?

4. **Payload shape** — What fields does execute() return to the instruction file?
   Name each field and describe its type and content.

5. **Instruction phases** — How many steps does the instruction file walk the LLM through?
   What does each phase produce? What decisions does the LLM need to make?

6. **Output deliverables** — What are the final outputs? Files written? Suggestions made?
   Specs produced?

7. **Edge cases** — What should happen if args are missing? If a file doesn't exist?
   If the user's input is ambiguous? If execute() can't find required context?

8. **Naming** — What is the command name? What is the natural invocation trigger phrase
   (this becomes the `description` in the tool definition)?

Present a complete spec summary after gathering answers. Ask the user to confirm or amend
before writing any files.

## Phase 3 — Confirm the Spec

Present the full spec in structured form:

```
Command name:       <name>
Plugin:             <plugin file>
Instruction file:   .opencode/plugins/instructions/<plugin>-<name>.md
DEFAULT_ constant:  DEFAULT_<PLUGIN>_<NAME>_COMMAND (fallback content in .ts)

Args:
  <arg>: <type> (required/optional) — <description>

Execute() reads:
  - <file/env/value>

Payload fields:
  - <field>: <type> — <description>

Instruction phases:
  1. <phase name> — <what it does>
  2. ...

Output deliverables:
  - <what is produced>

Edge cases:
  - <case> → <behavior>
```

Ask explicitly: "Does this spec look right before I write the files?" Do not proceed
until the user confirms.

## Phase 4 — Write the Files

Write in this order:

### 4a — Instruction file

Write `.opencode/plugins/instructions/<plugin>-<name>.md`.

Structure:
- Opening paragraph: what this command does and what payload is available
- One section per instruction phase, in order
- Edge case handling for known failure modes
- Output deliverables section

Reference payload fields using plain language ("the `targetPath` field from the payload
contains…"). Do not embed raw JSON — read the existing files to see how they do it.

### 4b — DEFAULT_* constant

In the same edit or a separate one: prepare the DEFAULT_<PLUGIN>_<NAME>_COMMAND string
constant that embeds the instruction file content as a TypeScript template literal.
This is the fallback if the `.md` file is not found at runtime.

Show the TypeScript constant to the user:
```typescript
export const DEFAULT_<PLUGIN>_<NAME>_COMMAND = `
<instruction content>
`;
```

### 4c — Tool definition

Write the `tool()` definition (TypeScript) to be added to the existing plugin `.ts` file.

Follow the exact conventions observed in Step 1:
- `description`: natural-language trigger phrase the user would say
- `args`: Zod schema with `.describe()` on each field
- `execute()`: read context, build payload, return `{ status: "INSTRUCTION_READY", ...payload }`
- Error path: return `{ status: "ERROR", message: "..." }` for unrecoverable failures

Show the tool definition to the user before inserting it.

Insert it into the plugin `.ts` file in the correct place (following the pattern of existing
tool registrations).

## Phase 5 — Smoke Test

After all files are written:

1. **Compile check**: run `npx tsc --noEmit` in the plugin directory. If a `tsconfig.json`
   does not exist, run it from the project root or with `--target ES2020 --moduleResolution node`
   flags. Fix any type errors before proceeding.
2. Verify the instruction file is referenced correctly from the DEFAULT_* constant
3. Confirm the payload fields named in the instruction file match those returned by execute()
4. Check that the tool `description` is specific enough to be unambiguous from sibling commands

Report any issues. Ask the user if they want fixes applied.

## OC Plugin Conventions (Reference)

Summarised from Step 1 + Step 0 docs. Apply these throughout:

- **Tool factory**: `tool({ description, args, execute })` — no class or decorator pattern
- **Zod args**: use `z.object({})` for all args; `.describe()` every field; mark optional with `.optional()`
- **execute() always returns** a plain object. The status field drives the LLM's next action
- **`INSTRUCTION_READY`** means the LLM should follow the instruction file; payload provides context
- **Instruction file path**: `.opencode/plugins/instructions/<plugin>-<command>.md`
- **DEFAULT_* constant**: always provide — it is the last resort if the `.md` file is missing
- **Helper functions**: extract repeated Glob/Read logic into named helpers at the top of the `.ts` file
- **No user I/O in execute()**: execute() must be side-effect-free. All writing happens in the instruction phase
- **Naming**: command name uses snake_case; instruction file uses kebab-case

## Output Deliverables

- `.opencode/plugins/instructions/<plugin>-<name>.md` — instruction file (written)
- TypeScript `DEFAULT_*` constant (shown, then written)
- TypeScript `tool()` definition (shown, then inserted into plugin `.ts`)
- Smoke test report (any type errors or payload mismatches)
