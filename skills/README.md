# Keel agent skills

Canonical Agent Skills for implementing Keel from either side of the wire.
Each folder is a valid skill (`SKILL.md` with YAML frontmatter) for Claude
Code, Grok, and any consumer of the [Agent Skills](https://agentskills.io)
layout.

| Skill | When |
| --- | --- |
| `keel-host` | Server: pages, actions, CSRF, schema, pack-at-render, head, CSP, pack hot reload |
| `keel-pack` | Pack: Svelte pages, `+head.svelte`, contracts, navigation guards, action effects, `.feb` |
| `keel-scaffold` | `keel-scaffold <origin> <dir>` from `GET /__keel/schema` |

## Shipped source vs local installs

`skills/` is the published source of truth, installable with
`npx skills add KolektivComputer/keel`. The CLI writes consumer copies into
agent directories (`.agents/skills/`, `.claude/skills/`, etc.) plus
`skills-lock.json`; those are local installs only. This repository gitignores
them so installed copies are never discovered or shipped from here.

## Companion skills

Styling a pack with Tailwind 4 + daisyUI 5? Install the official daisyUI
skill alongside the Keel skills:

```bash
npx skills add saadeghi/daisyui -s daisyui -a kilo -y
```

That repository also ships `daisyui-install`, `daisyui-config`,
`daisyui-colors`, and `daisyui-usage`. Our docs site and Harbor sample use
daisyUI.

## Install

```bash
npx skills add KolektivComputer/keel
```

Installs all three skills in the current project. Useful flags:

- `-a claude-code -a grok -a kilo` — target specific agents (repeatable).
- `-g` — install globally (`~/.<agent>/skills`) instead of the project.
- `--copy` — copy instead of symlinking; useful on Windows or in Docker.
- `--skill keel-host` — install just one skill (repeatable).
- `--list` — list the skills a repository exposes without installing.

You can also copy the folders you want into the agent's project skills
directory (or symlink). One copy in this repo is the source of truth — do not
fork the markdown into per-agent trees.

```bash
# Claude Code (project)
cp -R skills/keel-host skills/keel-pack skills/keel-scaffold .claude/skills/

# Grok (project)
cp -R skills/keel-host skills/keel-pack skills/keel-scaffold .grok/skills/

# Agnostic / Codex / Copilot / Amp
mkdir -p .agents/skills
cp -R skills/keel-host skills/keel-pack skills/keel-scaffold .agents/skills/
```

Personal (all repos): the same paths under `~/.claude/skills`, `~/.grok/skills`,
or `~/.agents/skills`.

`llms.txt` at the site root lists these skills with raw URLs.
