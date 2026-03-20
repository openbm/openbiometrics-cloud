# OpenBiometrics AI Agent System

Autonomous agents that manage and grow the platform. Each agent runs on a schedule
via GitHub Actions, uses Claude Code, and has a specific role with defined boundaries.

## Agents

| Agent | Schedule | Role | Repo |
|-------|----------|------|------|
| content-writer | Daily 6am UTC | Write blog posts, update docs | cloud |
| growth-analyst | Weekly Monday 8am | Analyze traffic, SEO, suggest improvements | cloud |
| platform-engineer | On PR / Daily | Code review, bug fixes, feature development | both |
| support-agent | Every 4 hours | Triage issues, answer discussions, update FAQ | engine |
| devops-monitor | Every 30 min | Health checks, alerts, auto-recovery | cloud |
| revenue-optimizer | Weekly Friday | Analyze usage, pricing, conversion | cloud |

## How It Works

1. GitHub Actions trigger Claude Code with a role-specific prompt
2. Agent reads its CLAUDE.md instructions + memory files
3. Agent performs its task (creates PR, deploys, writes content, etc.)
4. Results are logged and optionally create GitHub Issues for human review

## Human Oversight

- Agents create PRs, not direct pushes (except devops-monitor for emergencies)
- Weekly digest issue summarizes all agent activity
- Any agent can be paused by disabling its workflow
