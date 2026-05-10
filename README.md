# Agentic Plugin

Public distribution repository for Nominex Agentic tooling across both Claude Code and OpenCode runtimes.

## Repository layout

```text
agentic-plugin/
├── .claude-plugin/
│   ├── plugin.json
│   └── marketplace.json
├── claudecode/
│   └── agentic-plugin/
│       ├── README.md
│       ├── LICENSE.md
│       ├── .claude-plugin/
│       └── skills/
└── opencode/
    └── agentic-plugin/
        ├── README.md
        ├── opencode.json
        ├── package.json
        └── plugins/
```

## Runtime surfaces

- `claudecode/agentic-plugin/` - Claude Code plugin package and skills
- `opencode/agentic-plugin/` - OpenCode plugin package and instruction-backed commands

## Installation

### Claude Code (project scope)

From your project root (assuming this repo is cloned as `./agentic-plugin`):

```bash
claude plugin marketplace add ./agentic-plugin
claude plugin install agentic@nominex-agentic-plugin-marketplace --scope project
claude plugin reload
```

Scope notes:
- `--scope project` installs only for the current project (recommended)
- `--scope user` installs globally for your user account

## Source and sync

This repository is sync-managed from the canonical harness workspace. Release sync publishes
both runtime surfaces together.
