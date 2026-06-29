#!/usr/bin/env python3
"""
Import one LK150 course from the legacy SQL export CSV into course-poc JSON.

Usage (from repo root):
  python src/lib/legacy_kin/import_lk150_course_poc.py --challenge-id 51
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from legacy_course_import import (
    CLEANED_DIR,
    EXPORTS_DIR,
    ROOT,
    export_filename,
    group_rows_by_course,
    import_course_rows,
    load_csv_rows,
    poc_filename,
    resolve_csv_path,
    write_json,
)


def write_export_slice(
    csv_path: Path, challenge_id: int, title: str, rows: list[dict[str, str]]
) -> None:
    import csv

    EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
    out_path = EXPORTS_DIR / export_filename(challenge_id, title)
    fieldnames = list(rows[0].keys())
    with out_path.open("w", encoding="utf-8", newline="") as dst:
        writer = csv.DictWriter(dst, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--challenge-id", type=int, required=True)
    parser.add_argument(
        "--csv",
        type=Path,
        default=None,
        help="Path to legacy course CSV (auto-detected by default)",
    )
    args = parser.parse_args()

    csv_path = resolve_csv_path(args.csv)
    grouped = group_rows_by_course(load_csv_rows(csv_path))
    rows = grouped.get(args.challenge_id)
    if not rows:
        raise SystemExit(f"No rows found for ChallengesID {args.challenge_id}")

    source_csv = str(csv_path.relative_to(ROOT)).replace("\\", "/")
    export_name = export_filename(args.challenge_id, rows[0]["CourseTitle"].strip())
    payload, pending, _raw, _skipped = import_course_rows(
        args.challenge_id,
        rows,
        source_export=export_name,
        source_csv=source_csv,
    )

    title = payload["course"]["title"]
    out_path = CLEANED_DIR / poc_filename(args.challenge_id, title)
    write_export_slice(csv_path, args.challenge_id, title, rows)
    write_json(out_path, payload)

    lesson_count = len(payload["lessons"])
    block_count = sum(len(lesson["blocks"]) for lesson in payload["lessons"])

    print(f"Wrote {out_path.relative_to(ROOT)}")
    print(f"ChallengesID: {args.challenge_id}")
    print(f"Title: {title}")
    print(f"Lessons: {lesson_count}")
    print(f"Blocks: {block_count}")
    print(f"Unconverted components: {len(pending)}")
    for item in pending:
        print(
            f"  - lesson {item['lessonId']} assign {item['assignId']} "
            f"component {item['componentId']} ({item['kind']}): {item['title']}"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
