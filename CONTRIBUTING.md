# Contributing to ledjay-skills

Thanks for your interest in contributing to this repository of AI agent skills.

## Quick Start

```bash
# 1. Fork and clone
git clone https://github.com/YOUR_USERNAME/ledjay-skills.git
cd ledjay-skills

# 2. Install security tools (required)
brew install lefthook gitleaks

# 3. Initialize git hooks
lefthook install

# 4. Create your branch
git checkout -b feat/my-skill
```

## Security Requirements

**All contributions are automatically scanned** for security issues.

### Pre-commit Checks

Before each commit, these checks run automatically:

| Check | What it detects |
|-------|------------------|
| `security-scan.py` | Prompt injection, malicious code, data exfiltration |
| `gitleaks` | Hardcoded secrets, API keys, tokens |
| `unicode-check.py` | Unicode smuggling, invisible characters |

### If a check fails

1. **Prompt injection**: Remove patterns like "ignore previous instructions"
2. **Secrets detected**: Remove hardcoded credentials or add to `.gitleaks.toml`
3. **Unicode issues**: Remove invisible characters (zero-width, Unicode Tags)

### CI/CD Scanning

Every pull request is automatically scanned by:
- **Cisco Skill Scanner** - Multi-engine detection
- **Local security scripts** - Pattern matching
- **Gitleaks** - Secret detection

Results appear in the **Security** tab.

## How to Contribute

1. **Fork** the repository
2. **Install security tools** (see above)
3. **Create a branch** for your contribution
   ```bash
   git checkout -b feat/my-skill
   ```
4. **Create your skill** using `_template/` as reference
5. **Test locally**
   ```bash
   # Run security scan manually
   python3 scripts/security-scan.py my-skill/SKILL.md
   
   # Run unicode check
   python3 scripts/unicode-check.py my-skill/SKILL.md
   ```
6. **Commit** your changes (hooks run automatically)
7. **Push** the branch
   ```bash
   git push origin feat/my-skill
   ```
8. Open a **Pull Request**

## Skill Structure

Use the `_template/` folder as reference. Choose the right template:

| Template | Type | Use For |
|----------|------|---------|
| `SKILL.md` | Rules | Best practices, patterns, guidelines |
| `SKILL-TOOL.md` | Tool | API documentation, tool usage |
| `SKILL-WORKFLOW.md` | Workflow | Questionnaires, onboarding, configuration |

```
my-skill/
├── SKILL.md        # Required: skill definition
├── README.md       # Optional: documentation
└── references/     # Optional: reference files
```

## Security Best Practices

### ✅ DO

- Keep SKILL.md under 500 lines
- Use clear, specific descriptions
- Document all scripts and their purpose
- Use relative paths, not absolute
- Validate all user inputs

### ❌ DON'T

- Include hardcoded credentials
- Use `eval()`, `exec()`, or dynamic code execution
- Make network requests to unknown domains
- Hide instructions in comments or encoded strings
- Use Unicode tricks or zero-width characters

## Naming Conventions

- **Directory name**: `kebab-case` (e.g., `design-tokens`, `react-patterns`)
- **Main file**: `SKILL.md` (always this exact name)
- **Length**: 1-64 characters
- Allowed characters: lowercase letters, numbers, hyphens

## SKILL.md Format

```markdown
---
name: my-skill
description: One sentence describing when to use this skill.
  Include trigger keywords.
version: 1.0.0
compatible-agents:
  - letta-code
  - codex
  - claude-code
  - cursor
tags:
  - tag1
  - tag2
author:
  name: Your Name
  url: https://your-website.com
license: MIT
---

# Skill Title

Description of what the skill does.

## When to Use

- Condition 1
- Condition 2

## Instructions

Main skill content goes here.
```

## Testing

Before submitting, verify the skill works with:

- [ ] Letta Code
- [ ] Claude Code
- [ ] Codex

## Need Help?

- Check `_template/examples/` for working examples
- Read `SECURITY.md` for security details
- Open an issue for questions

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
