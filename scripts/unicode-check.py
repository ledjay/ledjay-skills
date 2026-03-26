#!/usr/bin/env python3
"""
Unicode smuggling detector for markdown files.
Detects hidden Unicode characters that could be used for prompt injection.
"""

import sys
import unicodedata
from pathlib import Path

# Suspicious Unicode ranges
SUSPICIOUS_RANGES = {
    # Unicode Tags (used for invisible instructions)
    "unicode_tags": (0xE0000, 0xE007F),
    # Zero-width characters
    "zero_width": {
        0x200B,  # Zero Width Space
        0x200C,  # Zero Width Non-Joiner
        0x200D,  # Zero Width Joiner
        0x200E,  # Left-to-Right Mark
        0x200F,  # Right-to-Left Mark
        0xFEFF,  # Zero Width No-Break Space (BOM)
    },
    # Homoglyphs (confusable characters)
    "homoglyphs": {
        # Cyrillic lookalikes
        0x0430, 0x0435, 0x043E, 0x0440, 0x0441, 0x0443, 0x0445,
        # Greek lookalikes
        0x03B1, 0x03B5, 0x03B9, 0x03BF, 0x03C1, 0x03C5,
    },
}

# Control characters that shouldn't appear in markdown
CONTROL_CHARS = set(range(0x00, 0x20)) - {0x09, 0x0A, 0x0D}  # Allow tab, LF, CR

def check_file(filepath: str) -> list[dict]:
    """Check a file for suspicious Unicode characters."""
    issues = []
    path = Path(filepath)
    
    if not path.exists():
        return issues
    
    try:
        content = path.read_text(encoding='utf-8', errors='ignore')
    except Exception as e:
        return [{"type": "error", "message": f"Could not read file: {e}"}]
    
    # Check for Unicode Tags (invisible instructions)
    tag_count = 0
    for char in content:
        code = ord(char)
        if SUSPICIOUS_RANGES["unicode_tags"][0] <= code <= SUSPICIOUS_RANGES["unicode_tags"][1]:
            tag_count += 1
    
    if tag_count > 0:
        issues.append({
            "type": "unicode_tags",
            "severity": "CRITICAL",
            "message": f"Found {tag_count} Unicode Tag characters (invisible instructions)",
            "count": tag_count
        })
    
    # Check for zero-width characters
    zw_chars = []
    for i, char in enumerate(content):
        code = ord(char)
        if code in SUSPICIOUS_RANGES["zero_width"]:
            zw_chars.append((i, hex(code), unicodedata.name(char, "UNKNOWN")))
    
    if len(zw_chars) > 5:  # Allow a few (emojis use them)
        issues.append({
            "type": "zero_width",
            "severity": "HIGH",
            "message": f"Found {len(zw_chars)} zero-width characters",
            "positions": zw_chars[:10]  # First 10
        })
    
    # Check for control characters
    control_found = []
    for i, char in enumerate(content):
        if ord(char) in CONTROL_CHARS:
            control_found.append((i, hex(ord(char))))
    
    if control_found:
        issues.append({
            "type": "control_chars",
            "severity": "MEDIUM",
            "message": f"Found {len(control_found)} unexpected control characters",
            "positions": control_found[:5]
        })
    
    # Check for homoglyphs that might be used for impersonation
    homoglyph_count = 0
    for char in content:
        if ord(char) in SUSPICIOUS_RANGES["homoglyphs"]:
            homoglyph_count += 1
    
    # Note: homoglyphs are common in some languages, so only flag if concentrated
    if homoglyph_count > 10:
        issues.append({
            "type": "homoglyphs",
            "severity": "LOW",
            "message": f"Found {homoglyph_count} potential homoglyph characters"
        })
    
    return issues

def main():
    if len(sys.argv) < 2:
        print("Usage: unicode-check.py <file1> [file2] ...")
        sys.exit(1)
    
    all_issues = []
    
    for filepath in sys.argv[1:]:
        issues = check_file(filepath)
        if issues:
            all_issues.append((filepath, issues))
    
    if all_issues:
        print(f"\n🔤 Unicode issues detected:\n")
        for filepath, issues in all_issues:
            print(f"📄 {filepath}")
            for issue in issues:
                print(f"   [{issue['severity']}] {issue['type']}: {issue['message']}")
        
        sys.exit(1)
    else:
        print("✅ No Unicode issues detected")
        sys.exit(0)

if __name__ == "__main__":
    main()
