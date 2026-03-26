#!/usr/bin/env python3
"""
Security scanner for SKILL.md files and scripts.
Detects prompt injection, malicious code patterns, and data exfiltration.
"""

import argparse
import re
import sys
from pathlib import Path

# Files to skip (self-referential)
SKIP_FILES = {
    "scripts/security-scan.py",
    "scripts/unicode-check.py",
}

# Patterns for SKILL.md files
SKILL_PATTERNS = {
    # Prompt injection patterns
    "prompt_injection": [
        r"ignore\s+(all\s+)?previous\s+instructions?",
        r"ignore\s+(the\s+)?above",
        r"disregard\s+(all\s+)?previous",
        r"forget\s+(all\s+)?previous",
        r"you\s+are\s+now\s+\w+",
        r"system\s*:\s*you\s+are",
        r"\[SYSTEM\]",
        r"<\|system\|>",
        r"###\s*SYSTEM",
        r"jailbreak",
        r"DAN\s*:",
        r"Do Anything Now",
    ],
    
    # Obfuscation patterns
    "obfuscation": [
        r"base64\.b64decode\s*\(",
        r"atob\s*\(['\"][A-Za-z0-9+/=]{20,}",
        r"btoa\s*\(",
        r"\\x[0-9a-fA-F]{2}\\x[0-9a-fA-F]{2}\\x[0-9a-fA-F]{2}",
        r"fromCharCode\s*\(\s*\d+\s*,",
    ],
    
    # Data exfiltration patterns (only suspicious endpoints)
    "exfiltration": [
        r"curl\s+['\"]https?://[^\s'\"]+\.(?:xyz|top|click|link|work)",
        r"fetch\s*\(\s*['\"]https?://[^\s'\"]*webhook",
        r"fetch\s*\(\s*['\"]https?://[^\s'\"]+\.xyz",
        r"axios\.(?:post|put)\s*\(\s*['\"]https?://[^\s'\"]+\.xyz",
        r"multipart/form-data.*fetch",
        r"upload.*to\s+['\"]https?://",
    ],
    
    # Suspicious URLs
    "suspicious_urls": [
        r"https?://[^\s'\"]+\.(?:xyz|top|click|link|work|party|space)",
        r"https?://[^\s'\"]*webhook[^/\s'\"]*['\"]",
        r"https?://[^\s'\"]*paste\.",
        r"ngrok-free\.app",
    ],
    
    # Credential patterns (actual hardcoded values)
    "credentials": [
        r"api[_-]?key\s*=\s*['\"][a-zA-Z0-9_-]{32,}['\"]",
        r"secret[_-]?key\s*=\s*['\"][a-zA-Z0-9_-]{32,}['\"]",
        r"private[_-]?key\s*=\s*['\"]-----BEGIN",
        r"Authorization\s*:\s*Bearer\s+[a-zA-Z0-9_-]{40,}",
    ],
}

# Patterns for scripts (JS/TS/Python/Shell)
SCRIPT_PATTERNS = {
    # Dangerous code execution
    "code_execution": [
        r"\beval\s*\(\s*['\"`]",
        r"\bnew\s+Function\s*\(\s*['\"`]",
        r"\bexec\s*\(\s*['\"`]",
        r"\bexecSync\s*\(\s*['\"`]",
        r"child_process.*exec\s*\(",
        r"\bspawn\s*\(\s*['\"`]/",
        r"\bspawnSync\s*\(\s*['\"`]/",
        r"subprocess\.(?:call|run|Popen)\s*\(\s*['\"`]",
        r"os\.system\s*\(\s*['\"`]",
    ],
    
    # File system manipulation (destructive)
    "filesystem": [
        r"rm\s+-rf\s+/(?:Users|home|etc|var)",
        r"rm\s+-rf\s+['\"]/",
        r"fs\.rm\s*\(\s*['\"]/",
        r"shutil\.rmtree\s*\(\s*['\"]/",
        r">\s*/dev/(?:sda|nvme|hda)",
        r"dd\s+if=/dev/zero",
    ],
    
    # Network operations (suspicious endpoints)
    "network": [
        r"curl\s+['\"]https?://[^\s'\"]+\.(?:xyz|top|click|link)",
        r"wget\s+['\"]https?://[^\s'\"]+\.(?:xyz|top|click)",
        r"nc\s+-[elp]+\s+['\"]?[^\s'\"]+\.(?:xyz|top)",
        r"fetch\s*\(\s*['\"]https?://[^\s'\"]*webhook",
        r"axios\.(?:post|put)\s*\(\s*['\"]https?://[^\s'\"]*webhook",
    ],
    
    # Obfuscation (suspicious)
    "obfuscation": [
        r"Buffer\.from\s*\([^)]*,\s*['\"]base64['\"]\)\.toString\s*\(",
        r"atob\s*\(\s*['\"][A-Za-z0-9+/=]{50,}",
        r"String\.fromCharCode\s*\(\s*\d+\s*,\s*\d+\s*,\s*\d+",
        r"\\x[0-9a-fA-F]{2}(?:\\x[0-9a-fA-F]{2}){5,}",
    ],
    
    # Privilege escalation
    "privilege": [
        r"\bsudo\s+chmod\s+[0-7]*[47]77",
        r"\bsudo\s+rm\s+-rf\s+/",
        r"setuid\s*\(\s*0\s*\)",
        r"chmod\s+4777",
        r"'/etc/passwd'.*write",
        r"'/etc/shadow'.*read",
    ],
    
    # Data exfiltration to suspicious endpoints
    "exfiltration": [
        r"fetch\s*\(\s*['\"]https?://[^\s'\"]+\.(?:xyz|top|click|link)",
        r"axios\.(?:post|put)\s*\(\s*['\"]https?://[^\s'\"]+\.(?:xyz|top)",
        r"curl\s+.*-d\s+.*['\"]https?://[^\s'\"]*webhook",
        r"multipart.*upload.*['\"]https?://[^\s'\"]+\.(?:xyz|top)",
    ],
    
    # Suspicious URLs
    "suspicious_urls": [
        r"https?://[^\s'\"]+\.(?:xyz|top|click|link|work|party|space)",
        r"https?://[^\s'\"]*ngrok-free\.app",
        r"https?://[^\s'\"]*paste\.[^\s'\"]*['\"]",
    ],
    
    # Credentials (hardcoded, high entropy)
    "credentials": [
        r"api[_-]?key\s*=\s*['\"][a-zA-Z0-9_-]{32,}['\"]",
        r"secret[_-]?key\s*=\s*['\"][a-zA-Z0-9_-]{32,}['\"]",
        r"private[_-]?key\s*=\s*['\"]-----BEGIN",
        r"access[_-]?token\s*=\s*['\"][a-zA-Z0-9_-]{40,}['\"]",
        r"Authorization\s*:\s*Bearer\s+[a-zA-Z0-9_-]{40,}",
    ],
}

def scan_file(filepath: str, patterns: dict) -> list[dict]:
    """Scan a single file for security issues."""
    issues = []
    path = Path(filepath)
    
    if not path.exists():
        return issues
    
    # Skip self-referential files
    for skip in SKIP_FILES:
        if skip in str(path):
            return issues
    
    try:
        content = path.read_text(encoding='utf-8', errors='ignore')
        lines = content.split('\n')
    except Exception as e:
        return [{"type": "error", "message": f"Could not read file: {e}", "line": 0}]
    
    for category, pattern_list in patterns.items():
        for pattern in pattern_list:
            for i, line in enumerate(lines, 1):
                # Skip lines that are just pattern definitions (in this file)
                if line.strip().startswith('r"') or line.strip().startswith("r'"):
                    continue
                if re.search(pattern, line, re.IGNORECASE):
                    issues.append({
                        "type": category,
                        "pattern": pattern,
                        "line": i,
                        "content": line.strip()[:100],
                        "severity": "HIGH" if category in ["code_execution", "filesystem", "network", "exfiltration", "prompt_injection", "privilege"] else "MEDIUM"
                    })
    
    return issues

def main():
    parser = argparse.ArgumentParser(description="Security scanner for skills and scripts")
    parser.add_argument("--scripts", action="store_true", help="Scan scripts instead of SKILL.md")
    parser.add_argument("files", nargs="+", help="Files to scan")
    args = parser.parse_args()
    
    patterns = SCRIPT_PATTERNS if args.scripts else SKILL_PATTERNS
    all_issues = []
    
    for filepath in args.files:
        issues = scan_file(filepath, patterns)
        if issues:
            all_issues.append((filepath, issues))
    
    if all_issues:
        scan_type = "scripts" if args.scripts else "skills"
        print(f"\n🚨 Security issues detected in {scan_type}:\n")
        for filepath, issues in all_issues:
            print(f"📄 {filepath}")
            for issue in issues:
                print(f"   [{issue['severity']}] {issue['type']}: {issue['content'][:60]}...")
                print(f"   Line {issue['line']}: pattern '{issue['pattern']}'\n")
        
        sys.exit(1)
    else:
        scan_type = "scripts" if args.scripts else "skills"
        print(f"✅ No security issues detected in {scan_type}")
        sys.exit(0)

if __name__ == "__main__":
    main()
