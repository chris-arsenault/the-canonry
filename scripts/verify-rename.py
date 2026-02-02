#!/usr/bin/env python3
"""
Verify that an entity rename was fully propagated through a bundle.json.

Reads the bundle as raw text, finds every occurrence of the old name
(case-insensitive), and resolves each hit to a JSON key path so you
can see exactly which field still contains the old name.

Usage:
    python verify-rename.py bundle.json "Old Entity Name"
    python verify-rename.py bundle.json "Old Entity Name" --partials
        (also checks individual words from the name)
"""

import sys
import re


def find_all_occurrences(text, needle):
    """Case-insensitive search for all occurrences."""
    results = []
    lower_text = text.lower()
    lower_needle = needle.lower()
    start = 0
    while True:
        idx = lower_text.find(lower_needle, start)
        if idx == -1:
            break
        results.append((idx, idx + len(needle)))
        start = idx + 1
    return results


def resolve_json_path(raw, offset):
    """
    Given a character offset into raw JSON, reconstruct the JSON key path
    by walking from the start and tracking nesting.
    """
    depth_stack = []  # stack of (container_type, key_or_label)
    i = 0
    current_key = None
    expecting_value = False
    array_indices = {}  # depth -> current index

    while i < offset:
        c = raw[i]

        # Skip whitespace
        if c in ' \t\n\r':
            i += 1
            continue

        # Strings
        if c == '"':
            end = i + 1
            while end < len(raw):
                if raw[end] == '\\':
                    end += 2
                    continue
                if raw[end] == '"':
                    break
                end += 1
            string_val = raw[i + 1:end]

            if expecting_value:
                # This string is a value — consume it
                expecting_value = False
            else:
                # Might be a key (if inside an object) or an array element
                d = len(depth_stack)
                if d in array_indices:
                    # Inside an array — this is an element, not a key
                    pass
                else:
                    current_key = string_val
            i = end + 1
            continue

        if c == ':':
            expecting_value = True
            i += 1
            continue

        if c == '{':
            label = current_key if current_key is not None else '$'
            depth_stack.append(('object', label))
            current_key = None
            expecting_value = False
            i += 1
            continue

        if c == '}':
            if depth_stack:
                depth_stack.pop()
            d = len(depth_stack)
            if d in array_indices:
                pass  # closing an object inside an array
            i += 1
            continue

        if c == '[':
            label = current_key if current_key is not None else '$'
            depth_stack.append(('array', label))
            d = len(depth_stack)
            array_indices[d] = 0
            current_key = None
            expecting_value = False
            i += 1
            continue

        if c == ']':
            d = len(depth_stack)
            if d in array_indices:
                del array_indices[d]
            if depth_stack:
                depth_stack.pop()
            i += 1
            continue

        if c == ',':
            d = len(depth_stack)
            if d in array_indices:
                array_indices[d] += 1
            current_key = None
            expecting_value = False
            i += 1
            continue

        # Numbers, booleans, null — skip
        i += 1

    # Build path from stack
    parts = []
    for idx, (container_type, label) in enumerate(depth_stack):
        parts.append(label)
        d = idx + 1
        if d in array_indices:
            parts.append(f'[{array_indices[d]}]')
    if current_key:
        parts.append(current_key)

    return '.'.join(parts) if parts else '$'


def main():
    if len(sys.argv) < 3:
        print('Usage: python verify-rename.py <bundle.json> "<old name>" [--partials]')
        sys.exit(1)

    bundle_path = sys.argv[1]
    old_name = sys.argv[2]
    check_partials = '--partials' in sys.argv

    with open(bundle_path, 'r', encoding='utf-8') as f:
        raw = f.read()

    print(f'Searching {len(raw):,} chars for "{old_name}"...\n')

    # Full name search
    occurrences = find_all_occurrences(raw, old_name)

    if not occurrences:
        print(f'  No occurrences of full name "{old_name}" found.')
    else:
        print(f'  {len(occurrences)} occurrence(s) of full name "{old_name}":\n')
        for start, end in occurrences:
            path = resolve_json_path(raw, start)
            ctx_start = max(0, start - 60)
            ctx_end = min(len(raw), end + 60)
            before = raw[ctx_start:start].replace('\n', ' ')
            match_text = raw[start:end]
            after = raw[end:ctx_end].replace('\n', ' ')

            print(f'    Path:    {path}')
            print(f'    Context: ...{before}>>>{match_text}<<<{after}...')
            print()

    # Partial name search (individual words, excluding stop words)
    if check_partials:
        stop_words = {
            'the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for', 'and',
            'or', 'but', 'is', 'was', 'are', 'were', 'be', 'been', 'by',
            'with', 'from', 'as', 'its', 'that', 'this', 'it', 'no', 'not',
        }
        words = re.split(r'[^a-zA-Z0-9]+', old_name)
        words = [w for w in words if w and len(w) >= 3 and w.lower() not in stop_words]

        if words:
            print(f'  --- Partial word check ({", ".join(words)}) ---\n')
            # Collect full-match positions to exclude
            full_positions = set()
            for start, end in occurrences:
                for p in range(start, end):
                    full_positions.add(p)

            for word in words:
                partials = find_all_occurrences(raw, word)
                # Exclude positions covered by full matches
                partials = [(s, e) for s, e in partials
                            if not any(p in full_positions for p in range(s, e))]
                if not partials:
                    continue
                print(f'    "{word}": {len(partials)} standalone occurrence(s)')
                for start, end in partials[:10]:  # cap at 10 per word
                    path = resolve_json_path(raw, start)
                    ctx_start = max(0, start - 40)
                    ctx_end = min(len(raw), end + 40)
                    before = raw[ctx_start:start].replace('\n', ' ')
                    match_text = raw[start:end]
                    after = raw[end:ctx_end].replace('\n', ' ')
                    print(f'      Path:    {path}')
                    print(f'      Context: ...{before}>>>{match_text}<<<{after}...')
                if len(partials) > 10:
                    print(f'      ... and {len(partials) - 10} more')
                print()

    # Summary
    total = len(occurrences)
    if total == 0:
        print('Result: CLEAN — no remaining references to the old name.')
    else:
        print(f'Result: {total} remaining reference(s) found. Review paths above.')


if __name__ == '__main__':
    main()
