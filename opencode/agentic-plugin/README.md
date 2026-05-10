# Agentic Plugin (OpenCode)

OpenCode artifact surface for the Agentic plugin.

## What this package contains

- `plugins/agentic.ts` - OpenCode plugin command definitions and system transform
- `plugins/instructions/agentic-*.md` - Agentic instruction files used by the plugin
- `opencode.json` - OpenCode runtime config snapshot for the harness bundle
- `package.json` - package metadata for OpenCode plugin distribution

## Notes

- This directory is distributed as part of the `agentic-plugin` carve-out under
  `opencode/agentic-plugin/`.
- Commands are implemented in TypeScript (`plugins/agentic.ts`) and instruction-backed
  via markdown files in `plugins/instructions/`.
