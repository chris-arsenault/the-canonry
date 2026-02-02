#!/usr/bin/env python3
import argparse
import os
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path

IMAGE_EXTS = {
    "apng",
    "avif",
    "bmp",
    "cr2",
    "cr3",
    "dng",
    "gif",
    "heic",
    "heif",
    "ico",
    "jp2",
    "j2k",
    "jpeg",
    "jpg",
    "nef",
    "orf",
    "png",
    "psb",
    "psd",
    "raw",
    "rw2",
    "sr2",
    "svg",
    "tif",
    "tiff",
    "webp",
}

DEFAULT_MIN_BYTES = 1_000_000

JSON_HINT_PHRASES = {
    "run-history",
    "run_history",
    "runhistory",
    "export-prompt-metadata",
    "export_prompt_metadata",
    "exportpromptmetadata",
}

JSON_HINT_WORDS = {
    "run",
    "history",
    "export",
    "prompt",
    "metadata",
    "debug",
    "trace",
    "tmp",
    "temp",
    "profile",
}


def run_git(args, input_text=None):
    result = subprocess.run(
        ["git"] + args,
        input=input_text,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=True,
    )
    return result.stdout


def repo_root():
    return run_git(["rev-parse", "--show-toplevel"]).strip()


def load_keep_paths(path):
    keep = []
    if not path:
        return keep
    p = Path(path)
    if not p.exists():
        return keep
    for raw in p.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        keep.append(line)
    return keep


def is_keep_path(path, keep_paths):
    for keep in keep_paths:
        if keep.endswith("/"):
            if path.startswith(keep):
                return True
        elif path == keep:
            return True
    return False


def is_debug_json(path):
    lower_path = path.lower()
    base = os.path.basename(lower_path)
    name = base.rsplit(".", 1)[0]

    for phrase in JSON_HINT_PHRASES:
        if phrase in name:
            return True

    if "export" in name and "prompt" in name and "metadata" in name:
        return True

    if any(word in name for word in ("debug", "trace", "tmp", "temp", "profile")):
        return True

    has_digits = any(ch.isdigit() for ch in name)
    if has_digits and any(word in name for word in ("run", "history", "export", "metadata")):
        return True

    # Directory-level hints help catch scattered artifacts.
    path_parts = re.split(r"[\\/\\s_-]+", lower_path)
    if any(part in JSON_HINT_WORDS for part in path_parts):
        if has_digits or "run" in path_parts or "history" in path_parts:
            return True

    return False


def list_object_paths():
    output = run_git(["rev-list", "--objects", "--all"])
    mapping = {}
    for line in output.splitlines():
        if not line:
            continue
        if " " not in line:
            continue
        sha, path = line.split(" ", 1)
        if not path:
            continue
        mapping.setdefault(sha, set()).add(path)
    return mapping


def list_blob_sizes(shas):
    sizes = {}
    if not shas:
        return sizes
    payload = "\n".join(shas)
    output = run_git(["cat-file", "--batch-check=%(objectname) %(objecttype) %(objectsize)"], input_text=payload)
    for line in output.splitlines():
        parts = line.split()
        if len(parts) != 3:
            continue
        name, obj_type, size = parts
        if obj_type != "blob":
            continue
        try:
            sizes[name] = int(size)
        except ValueError:
            continue
    return sizes


def file_ext(path):
    if "." not in path:
        return ""
    return path.rsplit(".", 1)[1].lower()


def git_last_change(path):
    try:
        out = run_git(["log", "-1", "--format=%H\t%cs", "--", path]).strip()
    except subprocess.CalledProcessError:
        return "", ""
    if not out:
        return "", ""
    parts = out.split("\t")
    if len(parts) == 2:
        return parts[0], parts[1]
    return out, ""


def write_tsv(path, header_lines, rows):
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    with p.open("w", encoding="utf-8") as handle:
        for line in header_lines:
            handle.write(f"# {line}\n")
        for row in rows:
            handle.write("\t".join(row) + "\n")


def scan(args):
    root = repo_root()
    keep_paths = load_keep_paths(args.keep_paths)

    mapping = list_object_paths()
    sizes = list_blob_sizes(mapping.keys())

    candidates = []
    json_review = []

    for sha, paths in mapping.items():
        size = sizes.get(sha)
        if size is None or size < args.min_bytes:
            continue
        for path in paths:
            if is_keep_path(path, keep_paths):
                continue
            ext = file_ext(path)
            if ext in IMAGE_EXTS:
                reason = "image"
            elif ext == "zip":
                reason = "zip"
            elif ext == "json":
                hint = is_debug_json(path)
                if args.json_mode == "hint" and not hint:
                    json_review.append((sha, path, size, "json"))
                    continue
                reason = "json" + ("-hint" if hint else "")
            else:
                continue

            candidates.append((sha, path, size, reason, ext))

    candidates.sort(key=lambda row: (-row[2], row[1]))
    json_review.sort(key=lambda row: (-row[2], row[1]))

    last_cache = {}

    def annotate(rows):
        annotated = []
        for sha, path, size, reason, ext in rows:
            if path not in last_cache:
                last_cache[path] = git_last_change(path)
            last_commit, last_date = last_cache[path]
            size_mb = f"{size / 1_000_000:.2f}"
            annotated.append(
                (
                    str(size),
                    size_mb,
                    ext,
                    reason,
                    path,
                    last_commit,
                    last_date,
                    sha,
                )
            )
        return annotated

    candidate_rows = annotate(candidates)

    header = [
        f"generated: {datetime.utcnow().isoformat()}Z",
        f"repo: {root}",
        f"min_bytes: {args.min_bytes}",
        f"json_mode: {args.json_mode}",
        f"keep_paths_file: {args.keep_paths or '(none)'}",
        "columns: size_bytes size_mb ext reason path last_commit last_date blob_sha",
        "edit this file to remove any paths you want to keep",
    ]

    write_tsv(args.output, header, candidate_rows)

    if args.json_mode == "hint" and json_review:
        review_rows = []
        for sha, path, size, reason in json_review:
            if path not in last_cache:
                last_cache[path] = git_last_change(path)
            last_commit, last_date = last_cache[path]
            size_mb = f"{size / 1_000_000:.2f}"
            review_rows.append(
                (
                    str(size),
                    size_mb,
                    "json",
                    reason,
                    path,
                    last_commit,
                    last_date,
                    sha,
                )
            )
        review_header = header + [
            "note: json_mode=hint so these are not in purge candidates; move any you want to purge",
        ]
        write_tsv(args.json_review_output, review_header, review_rows)

    total_bytes = sum(size for _, _, size, _, _ in candidates)
    print(f"Wrote {len(candidate_rows)} candidates to {args.output}")
    print(f"Total candidate size: {total_bytes / 1_000_000:.2f} MB")
    if args.json_mode == "hint" and json_review:
        print(f"Wrote {len(json_review)} large JSON review rows to {args.json_review_output}")


def parse_candidate_paths(path):
    paths = []
    for raw in Path(path).read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split("\t")
        if len(parts) >= 5:
            paths.append(parts[4])
        else:
            paths.append(line)
    return paths


def apply(args):
    keep_paths = load_keep_paths(args.keep_paths)
    candidate_paths = parse_candidate_paths(args.input)

    deduped = []
    seen = set()
    for path in candidate_paths:
        if is_keep_path(path, keep_paths):
            continue
        if path in seen:
            continue
        seen.add(path)
        deduped.append(path)

    if not deduped:
        print("No paths to purge after applying keep list.")
        return

    output_paths_file = Path(args.paths_output)
    output_paths_file.parent.mkdir(parents=True, exist_ok=True)
    output_paths_file.write_text("\n".join(deduped) + "\n")
    print(f"Wrote {len(deduped)} paths to {output_paths_file}")

    if args.dry_run:
        print("Dry run only; not rewriting history.")
        return

    run_git([
        "filter-repo",
        "--invert-paths",
        "--paths-from-file",
        str(output_paths_file),
        "--force",
    ])

    if not args.skip_gc:
        run_git(["reflog", "expire", "--expire=now", "--all"])
        run_git(["gc", "--prune=now", "--aggressive"])

    print("History rewrite complete.")


def main():
    parser = argparse.ArgumentParser(
        description="Scan git history for large images/zips/json and generate purge candidates.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    scan_parser = subparsers.add_parser("scan", help="Generate candidate purge list")
    scan_parser.add_argument("--min-bytes", type=int, default=DEFAULT_MIN_BYTES)
    scan_parser.add_argument("--json-mode", choices=["hint", "all"], default="hint")
    scan_parser.add_argument(
        "--output",
        default="history/purge_candidates.tsv",
        help="Path to write purge candidates",
    )
    scan_parser.add_argument(
        "--json-review-output",
        default="history/large_json_review.tsv",
        help="Path to write large JSON review list",
    )
    scan_parser.add_argument(
        "--keep-paths",
        default="history/keep_paths.txt",
        help="File of paths to keep (exact paths or directory prefixes ending with /)",
    )
    scan_parser.set_defaults(func=scan)

    apply_parser = subparsers.add_parser("apply", help="Rewrite history from curated list")
    apply_parser.add_argument(
        "--input",
        default="history/purge_candidates.tsv",
        help="Curated candidate file",
    )
    apply_parser.add_argument(
        "--paths-output",
        default="history/purge_paths.txt",
        help="Where to write the final list of paths to purge",
    )
    apply_parser.add_argument(
        "--keep-paths",
        default="history/keep_paths.txt",
        help="File of paths to keep (exact paths or directory prefixes ending with /)",
    )
    apply_parser.add_argument("--dry-run", action="store_true")
    apply_parser.add_argument("--skip-gc", action="store_true")
    apply_parser.set_defaults(func=apply)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
