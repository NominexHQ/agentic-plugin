# Agentic Plugin (OpenCode)

OpenCode package surface for Agentic developer tooling. This bundle provides
instruction-backed plugin commands for auditing Claude skills, porting behavior across
runtimes, building OpenCode commands, and managing agent model assignments.

## What this package contains

**Plugin metadata and runtime config:**
- `package.json` - OpenCode package metadata
- `opencode.json` - OpenCode runtime config snapshot

**Plugin implementation:**
- `plugins/agentic.ts` - command/tool definitions and system transform
- `plugins/instructions/agentic-*.md` - instruction files consumed by `agentic.ts`

## Quick start

Copy this package into your project's `.opencode/` directory.

From your project root (assuming this repo is cloned as `./agentic-plugin`):

```bash
mkdir -p .opencode
rsync -a ./agentic-plugin/opencode/agentic-plugin/ ./.opencode/
```

This installs:
- `.opencode/plugins/agentic.ts`
- `.opencode/plugins/instructions/agentic-*.md`
- `.opencode/opencode.json`
- `.opencode/package.json`

## Command surface

The OpenCode plugin currently exposes these Agentic commands:

- `agentic_build_command` - spec and build new OpenCode commands
- `agentic_audit_skill` - audit Claude Code skills across 12 dimensions
- `agentic_port_skill` - port Claude skills into OpenCode equivalents
- `agentic_model` - inspect/set/remove model assignments for OpenCode agents

These are wired through the system transform in `agentic.ts`, which routes user intent
to instruction files and command payload workflows.

## Runtime notes

- This directory is published into the carve-out repo under `opencode/agentic-plugin/`.
- Instruction precedence at runtime is still controlled by OpenCode/plugin behavior
  (`config/instructions` overrides, then plugin defaults).
- Keep `plugins/agentic.ts` and `plugins/instructions/agentic-*.md` in lockstep when
  adding or changing commands.
