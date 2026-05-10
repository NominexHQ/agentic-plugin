---
name: agentic-plugin
description: Developer tooling plugin for auditing, porting, and building Claude Code skills and OpenCode plugin commands.
---

# Agentic Plugin

Standalone Claude Code plugin for developer-focused agent tooling. This plugin packages
skills for auditing command/skill behavior, porting between Claude Code and OpenCode,
and building new commands or skills through structured workflows.

## What this repo contains

**Plugin metadata:**
- `.claude-plugin/plugin.json` - Claude plugin manifest (`name`, `version`, description)
- `.claude-plugin/marketplace.json` - standalone marketplace descriptor for this plugin

**Skills:**
- `skills/audit_command/SKILL.md` - audit an OpenCode plugin command
- `skills/audit_skill/SKILL.md` - audit a Claude Code skill
- `skills/build_command/SKILL.md` - build an OpenCode plugin command
- `skills/build_skill/SKILL.md` - build a Claude Code skill
- `skills/port_command/SKILL.md` - port OpenCode command to Claude Code target
- `skills/port_skill/SKILL.md` - port Claude Code skill to OpenCode target

## Canonical source and sync model

Canonical source currently lives inside the harness workspace at:

`agentic-harness-dev/agentic-harness/claudecode/agentic-plugin/`

This public repo is synced from that canonical path.

## Quick start

### Install via local marketplace descriptor

Default assumption: you clone `agentic-plugin` into an existing project directory
(not as the project root), then add that subdirectory as a marketplace.

Example layout:

```text
my-project/
└── agentic-plugin/
```

From `my-project/`:

```bash
claude plugin marketplace add ./agentic-plugin
claude plugin install agentic@nominex-agentic-plugin-marketplace --scope project
claude plugin reload
```

If you are inside the plugin repo root itself, `claude plugin marketplace add .` also works.

### Scope notes

- `--scope project` installs the plugin only for the current repository.
- `--scope user` installs it globally for your user account.
- Recommended default for development/testing is `--scope project` to avoid cross-project bleed.

### Use key skills

```text
agentic:build_skill "<plugin> <new-skill-name>"
agentic:build_command "<new-command-name>"
agentic:port_skill "<plugin> <skill-name>"
agentic:audit_skill "<plugin> <skill-name>"
```

## Skill surface

| Skill | Purpose | Typical trigger |
| --- | --- | --- |
| `agentic:audit_command` | Analyze OpenCode command contract/workflow for gaps | "audit this OC command" |
| `agentic:audit_skill` | Analyze Claude Code skill behavior and structure | "audit this skill" |
| `agentic:build_command` | Spec and build a new OpenCode command | "build a new OC tool" |
| `agentic:build_skill` | Spec and build a new Claude Code skill | "create a new skill" |
| `agentic:port_command` | Translate OpenCode command to Claude Code equivalent | "port this OC command" |
| `agentic:port_skill` | Translate Claude Code skill to OpenCode equivalent | "port this skill to OC" |

## Build and release workflow

1. **Edit canonical source** in this directory.
2. **Version bump** in `.claude-plugin/plugin.json` for plugin-level changes.
3. **Marketplace bump** in `.claude-plugin/marketplace.json` when publishing a new bundle.
4. **Commit and push** canonical updates.
5. **Sync this public repo** from canonical subtree.

Recommended commit style for plugin updates:
- `build: ...` for skill/package updates
- `release: ...` for explicit versioned release commits

## Repository structure

```text
agentic-plugin/
├── .claude-plugin/
│   ├── plugin.json
│   └── marketplace.json
└── skills/
    ├── audit_command/SKILL.md
    ├── audit_skill/SKILL.md
    ├── build_command/SKILL.md
    ├── build_skill/SKILL.md
    ├── port_command/SKILL.md
    └── port_skill/SKILL.md
```

## Design principles

- Keep workflows explicit, phase-based, and reproducible.
- Prefer spec-confirm-write loops over one-shot generation.
- Keep cross-runtime translation honest: call out non-translatable behavior.
- Reuse existing plugin conventions before introducing new patterns.
