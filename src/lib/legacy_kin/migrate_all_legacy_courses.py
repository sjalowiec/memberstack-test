#!/usr/bin/env python3
"""
Migrate all legacy KIN courses from the SQL export CSV into course-poc JSON drafts.

Usage (from repo root):
  python src/lib/legacy_kin/migrate_all_legacy_courses.py
  python src/lib/legacy_kin/migrate_all_legacy_courses.py --dry-run
  python src/lib/legacy_kin/migrate_all_legacy_courses.py --overwrite-hand-cleaned
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from legacy_course_import import (
    BACKUP_DIR,
    CLEANED_DIR,
    EXPORTS_DIR,
    HAND_CLEANED_COURSE_IDS,
    RAW_DIR,
    REPORTS_DIR,
    ROOT,
    SKIP_CATEGORY_HAND_CLEANED,
    SKIP_CATEGORY_INTERNAL,
    backup_existing_file,
    bulk_migration_skip_reason,
    collect_course_stats,
    export_filename,
    group_rows_by_course,
    import_course_rows,
    load_csv_rows,
    poc_filename,
    raw_archive_filename,
    resolve_csv_path,
    write_json,
)


def write_per_course_export(
    challenge_id: int, title: str, rows: list[dict[str, str]]
) -> Path:
    import csv

    EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
    out_path = EXPORTS_DIR / export_filename(challenge_id, title)
    fieldnames = list(rows[0].keys())
    with out_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    return out_path


def render_markdown_report(report: dict) -> str:
    lines = [
        "# Legacy course migration report",
        "",
        f"- Generated: {report['generatedAt']}",
        f"- Source CSV: `{report['sourceCsv']}`",
        f"- Dry run: {report['dryRun']}",
        "",
        "## Totals",
        "",
        f"- Courses in CSV: {report['totals']['coursesInCsv']}",
        f"- Courses migrated: {report['totals']['coursesMigrated']}",
        f"- Courses skipped: {report['totals']['coursesSkipped']}",
        f"- Skipped (hand-cleaned): {report['totals']['coursesSkippedHandCleaned']}",
        f"- Skipped (internal repository): {report['totals']['coursesSkippedInternal']}",
        f"- Lessons: {report['totals']['lessons']}",
        f"- Blocks: {report['totals']['blocks']}",
        f"- Unmapped components: {report['totals']['unmappedComponents']}",
        f"- Skipped CSV rows: {report['totals']['skippedRows']}",
        f"- Missing titles: {report['totals']['missingTitles']}",
        f"- Missing content: {report['totals']['missingContent']}",
        f"- Unique image references: {report['totals']['uniqueImageReferences']}",
        f"- Unique download references: {report['totals']['uniqueDownloadReferences']}",
        "",
    ]

    if report["skippedHandCleanedCourses"] or report["skippedInternalCourses"]:
        lines.extend(["## Skipped courses", ""])
        if report["skippedHandCleanedCourses"]:
            lines.extend(["", "### Hand-cleaned (preserved on disk)", ""])
            for item in report["skippedHandCleanedCourses"]:
                suffix = (
                    f" (`{item['existingFile']}`)"
                    if item.get("existingFile")
                    else ""
                )
                lines.append(
                    f"- **{item['legacyChallengeId']}** {item['title']}{suffix}: "
                    f"{item['reason']}"
                )
        if report["skippedInternalCourses"]:
            lines.extend(["", "### Internal repository (not migrated)", ""])
            for item in report["skippedInternalCourses"]:
                lines.append(
                    f"- **{item['legacyChallengeId']}** {item['title']}: "
                    f"{item['reason']}"
                )
        lines.append("")

    if report["unmappedComponents"]:
        lines.extend(["## Unmapped components", ""])
        for item in report["unmappedComponents"][:100]:
            lines.append(
                "- Course "
                f"{item['legacyChallengeId']} lesson {item['lessonId']} assign "
                f"{item['assignId']} component {item['componentId']} "
                f"({item['kind']}): {item['title']}"
            )
        if len(report["unmappedComponents"]) > 100:
            lines.append(
                f"- … and {len(report['unmappedComponents']) - 100} more (see JSON report)"
            )
        lines.append("")

    lines.extend(["## Courses", ""])
    for course in report["courses"]:
        lines.append(
            f"- **{course['legacyChallengeId']}** {course['title']} "
            f"(`{course['outputFile']}`) — {course['lessonCount']} lessons, "
            f"{course['pendingCount']} pending, "
            f"{len(course['imageReferences'])} image refs, "
            f"{len(course['downloadReferences'])} download refs"
        )
    lines.append("")
    return "\n".join(lines)


def migrate_all(
    *,
    csv_path: Path,
    dry_run: bool = False,
    overwrite_hand_cleaned: bool = False,
    write_exports: bool = True,
) -> dict:
    rows = load_csv_rows(csv_path)
    grouped = group_rows_by_course(rows)
    generated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    source_csv = str(csv_path.relative_to(ROOT)).replace("\\", "/")

    report: dict = {
        "generatedAt": generated_at,
        "sourceCsv": source_csv,
        "dryRun": dry_run,
        "totals": {
            "coursesInCsv": len(grouped),
            "coursesMigrated": 0,
            "coursesSkipped": 0,
            "coursesSkippedHandCleaned": 0,
            "coursesSkippedInternal": 0,
            "lessons": 0,
            "blocks": 0,
            "unmappedComponents": 0,
            "skippedRows": 0,
            "missingTitles": 0,
            "missingContent": 0,
            "uniqueImageReferences": 0,
            "uniqueDownloadReferences": 0,
        },
        "skippedHandCleanedCourses": [],
        "skippedInternalCourses": [],
        "skippedRows": [],
        "unmappedComponents": [],
        "courses": [],
        "backups": [],
    }

    all_images: set[str] = set()
    all_downloads: set[str] = set()

    for challenge_id in sorted(grouped):
        course_rows = grouped[challenge_id]
        title = course_rows[0]["CourseTitle"].strip()
        out_name = poc_filename(challenge_id, title)
        out_path = CLEANED_DIR / out_name

        skip = bulk_migration_skip_reason(
            challenge_id,
            poc_file_exists=out_path.exists(),
            overwrite_hand_cleaned=overwrite_hand_cleaned,
        )
        if skip:
            entry = {
                "legacyChallengeId": challenge_id,
                "title": title,
                "reason": skip["reason"],
                "category": skip["category"],
            }
            if skip["category"] == SKIP_CATEGORY_HAND_CLEANED:
                entry["existingFile"] = out_name
                report["skippedHandCleanedCourses"].append(entry)
                report["totals"]["coursesSkippedHandCleaned"] += 1
            elif skip["category"] == SKIP_CATEGORY_INTERNAL:
                report["skippedInternalCourses"].append(entry)
                report["totals"]["coursesSkippedInternal"] += 1
            report["totals"]["coursesSkipped"] += 1
            continue

        export_name = export_filename(challenge_id, title)
        payload, pending, raw_components, skipped_rows = import_course_rows(
            challenge_id,
            course_rows,
            source_export=export_name,
            source_csv=source_csv,
        )
        stats = collect_course_stats(payload, pending)
        all_images.update(stats["imageReferences"])
        all_downloads.update(stats["downloadReferences"])
        report["skippedRows"].extend(
            {**item, "legacyChallengeId": challenge_id, "courseTitle": title}
            for item in skipped_rows
        )

        course_entry = {
            "legacyChallengeId": challenge_id,
            "title": title,
            "slug": payload["course"]["slug"],
            "outputFile": out_name,
            "lessonCount": stats["lessonCount"],
            "blockCount": stats["blockCount"],
            "pendingCount": len(pending),
            "missingTitles": stats["missingTitles"],
            "missingContent": stats["missingContent"],
            "imageReferences": stats["imageReferences"],
            "downloadReferences": stats["downloadReferences"],
        }
        report["courses"].append(course_entry)
        report["unmappedComponents"].extend(
            {**item, "legacyChallengeId": challenge_id, "courseTitle": title}
            for item in pending
        )

        if dry_run:
            report["totals"]["coursesMigrated"] += 1
            report["totals"]["lessons"] += stats["lessonCount"]
            report["totals"]["blocks"] += stats["blockCount"]
            report["totals"]["unmappedComponents"] += len(pending)
            report["totals"]["skippedRows"] += len(skipped_rows)
            report["totals"]["missingTitles"] += len(stats["missingTitles"])
            report["totals"]["missingContent"] += len(stats["missingContent"])
            continue

        backup = backup_existing_file(out_path)
        if backup:
            report["backups"].append(str(backup.relative_to(ROOT)).replace("\\", "/"))

        write_json(out_path, payload)

        raw_path = RAW_DIR / raw_archive_filename(challenge_id, title)
        write_json(
            raw_path,
            {
                "legacyChallengeId": challenge_id,
                "title": title,
                "slug": payload["course"]["slug"],
                "sourceCsv": source_csv,
                "sourceExport": export_name,
                "migratedAt": payload["course"]["legacy"]["migratedAt"],
                "components": raw_components,
            },
        )

        if write_exports:
            write_per_course_export(challenge_id, title, course_rows)

        report["totals"]["coursesMigrated"] += 1
        report["totals"]["lessons"] += stats["lessonCount"]
        report["totals"]["blocks"] += stats["blockCount"]
        report["totals"]["unmappedComponents"] += len(pending)
        report["totals"]["skippedRows"] += len(skipped_rows)
        report["totals"]["missingTitles"] += len(stats["missingTitles"])
        report["totals"]["missingContent"] += len(stats["missingContent"])

    report["totals"]["uniqueImageReferences"] = len(all_images)
    report["totals"]["uniqueDownloadReferences"] = len(all_downloads)
    return report


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Migrate all legacy KIN courses from SQL export CSV to draft course-poc JSON."
    )
    parser.add_argument(
        "--csv",
        type=Path,
        default=None,
        help="Path to kin-all-legacy-courses-content.csv (auto-detected by default)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Analyze and report without writing course files",
    )
    parser.add_argument(
        "--overwrite-hand-cleaned",
        action="store_true",
        help=f"Replace hand-cleaned courses {sorted(HAND_CLEANED_COURSE_IDS)} after backup",
    )
    parser.add_argument(
        "--no-export-slices",
        action="store_true",
        help="Skip writing per-course CSV slices to src/data/legacy_kin/exports/",
    )
    args = parser.parse_args()

    csv_path = resolve_csv_path(args.csv)
    report = migrate_all(
        csv_path=csv_path,
        dry_run=args.dry_run,
        overwrite_hand_cleaned=args.overwrite_hand_cleaned,
        write_exports=not args.no_export_slices,
    )

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%dT%H%M%S")
    json_report_path = REPORTS_DIR / f"migration-{stamp}.json"
    md_report_path = REPORTS_DIR / f"migration-{stamp}.md"
    write_json(json_report_path, report)
    md_report_path.write_text(render_markdown_report(report) + "\n", encoding="utf-8")

    print(f"Source CSV: {csv_path.relative_to(ROOT)}")
    print(f"Dry run: {args.dry_run}")
    print(f"Courses in CSV: {report['totals']['coursesInCsv']}")
    print(f"Courses migrated: {report['totals']['coursesMigrated']}")
    print(f"Courses skipped: {report['totals']['coursesSkipped']}")
    print(
        f"  Hand-cleaned: {report['totals']['coursesSkippedHandCleaned']}, "
        f"Internal repository: {report['totals']['coursesSkippedInternal']}"
    )
    print(f"Lessons: {report['totals']['lessons']}")
    print(f"Blocks: {report['totals']['blocks']}")
    print(f"Unmapped components: {report['totals']['unmappedComponents']}")
    print(f"Skipped CSV rows: {report['totals']['skippedRows']}")
    print(f"Missing titles: {report['totals']['missingTitles']}")
    print(f"Missing content: {report['totals']['missingContent']}")
    print(f"Unique image references: {report['totals']['uniqueImageReferences']}")
    print(f"Unique download references: {report['totals']['uniqueDownloadReferences']}")
    print(f"Report JSON: {json_report_path.relative_to(ROOT)}")
    print(f"Report Markdown: {md_report_path.relative_to(ROOT)}")
    if report["backups"]:
        print(f"Backups written: {len(report['backups'])}")
    if report["skippedHandCleanedCourses"]:
        print("Skipped (hand-cleaned):")
        for item in report["skippedHandCleanedCourses"]:
            print(f"  - {item['legacyChallengeId']} {item['title']}: {item['reason']}")
    if report["skippedInternalCourses"]:
        print("Skipped (internal repository):")
        for item in report["skippedInternalCourses"]:
            print(f"  - {item['legacyChallengeId']} {item['title']}: {item['reason']}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
