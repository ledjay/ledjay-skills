# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in this repository, please report it privately:

- **Email**: security@jeremie-gisserot.net
- **GitHub**: Use the private vulnerability reporting feature

Do not open a public issue for security vulnerabilities.

## Security Measures

This repository implements multiple layers of security to protect against malicious skills:

### 1. Pre-commit Hooks (Lefthook)

```bash
# Install hooks
lefthook install

# Run manually
lefthook run pre-commit
```

**Checks:**
- `security-scan.py` - Detects prompt injection, malicious code, data exfiltration
- `gitleaks` - Detects hardcoded secrets
- `unicode-check.py` - Detects Unicode smuggling attacks

### 2. CI/CD Scanning (GitHub Actions)

Every pull request is automatically scanned:
- **Cisco Skill Scanner** - Multi-engine detection (static + LLM + dataflow)
- **Local security scan** - Pattern-based detection
- **Unicode check** - Invisible character detection
- **Gitleaks** - Secret detection

Results appear in the **Security** tab.

### 3. Threat Detection

We detect the following threat categories:

| Category | Examples | Severity |
|----------|----------|----------|
| **Prompt Injection** | "ignore previous instructions", DAN, jailbreak | 🔴 Critical |
| **Data Exfiltration** | curl to unknown domains, file uploads | 🔴 Critical |
| **Malicious Code** | eval(), exec(), reverse shells | 🔴 Critical |
| **Unicode Smuggling** | Invisible Unicode Tags, zero-width chars | 🔴 Critical |
| **Obfuscation** | Base64, hex encoding, fromCharCode | 🟡 High |
| **Credentials** | API keys, tokens, passwords | 🟡 High |
| **Suspicious URLs** | Unknown domains, webhook endpoints | 🟢 Medium |

### 4. Known Attack Patterns

Based on Snyk's ToxicSkills research and Cisco's threat intelligence:

**ClawHavoc Campaign Patterns:**
- Metadata poisoning with overbroad descriptions
- Credential theft via embedded scripts
- Atomic macOS Stealer (AMOS) payloads
- VMProtect-packed infostealers

**Prompt Injection Variants:**
- Instruction hierarchy overrides
- Unicode Tag smuggling (U+E0000-U+E007F)
- Zero-width character injection
- Base64/hex encoded instructions

**Data Exfiltration Methods:**
- Curl to attacker-controlled servers
- Multipart form uploads
- Webhook exfiltration
- Environment variable snooping

## Installing Security Tools

### Required (for contributors)

```bash
# Install Lefthook and Gitleaks
brew install lefthook gitleaks

# Initialize hooks
lefthook install
```

### Optional (enhanced scanning)

```bash
# Cisco Skill Scanner (Python 3.10+)
pip install cisco-ai-skill-scanner

# Run full scan
skill-scanner scan ./ --format text
```

## Security Best Practices for Skills

When contributing skills, follow these guidelines:

### ✅ DO

- Keep SKILL.md under 500 lines
- Use clear, specific descriptions
- Document all scripts and their purpose
- Use relative paths, not absolute
- Validate all user inputs

### ❌ DON'T

- Don't include hardcoded credentials
- Don't use `eval()`, `exec()`, or dynamic code execution
- Don't make network requests to unknown domains
- Don't hide instructions in comments or encoded strings
- Don't use Unicode tricks or zero-width characters

## False Positives

If a security scan produces false positives:

1. Check if the pattern is legitimate (e.g., example code)
2. Add to `.gitleaks.toml` allowlist if it's a secret false positive
3. Document in the skill's README if it's a known pattern

## References

- [Snyk ToxicSkills Research](https://snyk.io/blog/toxicskills-malicious-ai-agent-skills-clawhub/)
- [Cisco Skill Scanner](https://github.com/cisco-ai-defense/skill-scanner)
- [OWASP Top 10 for Agentic Applications](https://owasp.org/www-project-top-10-for-agentic-applications/)
- [Agent Skills Security Research](https://arxiv.org/abs/2601.10338)
