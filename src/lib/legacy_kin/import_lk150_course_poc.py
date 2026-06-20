#!/usr/bin/env python3
"""
Import one LK150 course from data/KIN lk150 courses.csv into course-poc JSON.

Usage (from repo root):
  python src/lib/legacy_kin/import_lk150_course_poc.py --challenge-id 51
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[3]
CSV_PATH = ROOT / "data/KIN lk150 courses.csv"
CLEANED_DIR = ROOT / "src/data/legacy_kin/cleaned"
EXPORTS_DIR = ROOT / "src/data/legacy_kin/exports"

VAR_RE = re.compile(
    r"<var name='([^']+)'>\s*<string>([\s\S]*?)</string>\s*</var>",
    re.IGNORECASE,
)
VIMEO_IFRAME_RE = re.compile(r"player\.vimeo\.com/video/(\d+)", re.IGNORECASE)
VIMEO_DATA_RE = re.compile(r"data-vimeoid\s*=\s*[\"']?(\d+)", re.IGNORECASE)
EMBED_VIDEO_RE = re.compile(
    r"<div class='embed-video-container'>[\s\S]*?</div>",
    re.IGNORECASE,
)

SKIP_COMPONENT_TYPES = {
    "ContinueButton",
    "PrintWindowButton",
    "RedirectButton",
    "boxtop",
    "boxbottom",
}

MIGRATION_NOTES: dict[str, list[str]] = {
    "CustomCFM": [
        "Legacy ColdFusion interactive tool.",
        "Replace with equivalent KBM interactive tool.",
    ],
    "Pattern": [
        "Dynamic pattern generator (legacy garment workflow).",
        "Requires swatch/gauge datamodel session state before pattern output.",
    ],
    "DataValidation": [
        "Validates legacy datamodel fields and redirects when validation fails.",
    ],
    "DocumentPattern": [
        "Dynamic pattern PDF download from datamodel field.",
        "Depends on Pattern component output; not a static file.",
    ],
    "Pinterest": [
        "Legacy Pinterest embed; replace with static content or omit.",
    ],
}


def replace_char_codes(value: str) -> str:
    return re.sub(
        r"<char code='([0-9a-fA-F]{2})'\s*/>",
        lambda m: chr(int(m.group(1), 16)),
        value,
    )


def decode_entities(value: str) -> str:
    value = (
        value.replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", '"')
        .replace("&apos;", "'")
        .replace("&#39;", "'")
    )
    value = re.sub(r"&#(\d+);", lambda m: chr(int(m.group(1))), value)
    value = re.sub(
        r"&#x([0-9a-fA-F]+);", lambda m: chr(int(m.group(1), 16)), value
    )
    return value.replace("&amp;", "&")


def parse_wddx(raw: str) -> dict[str, str]:
    if not raw or not re.search(r"<wddxPacket", raw, re.IGNORECASE):
        return {}
    return {
        name: decode_entities(replace_char_codes(value))
        for name, value in VAR_RE.findall(raw)
    }


def slugify(value: str) -> str:
    slug = value.lower().strip()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug or "untitled"


def effective_type(component_type: str, vars_map: dict[str, str]) -> str:
    inner = (vars_map.get("TYPEOF") or "").strip()
    if inner:
        return inner
    return component_type


def extract_vimeo_id(html: str) -> str | None:
    if not html:
        return None
    match = VIMEO_IFRAME_RE.search(html) or VIMEO_DATA_RE.search(html)
    return match.group(1) if match else None


def strip_embedded_videos(html: str) -> str:
    cleaned = EMBED_VIDEO_RE.sub("", html)
    cleaned = re.sub(
        r"<div class=\"col-sm-6 col-xs-12\"></div>",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )
    return cleaned.strip()


def extract_slides(vars_map: dict[str, str]) -> list[dict[str, str | None]]:
    slides: list[dict[str, str | None]] = []
    for index in range(40):
        image = (vars_map.get(f"SLIDESHOWIMAGE_{index}") or "").strip()
        caption = (vars_map.get(f"SLIDESHOWCAPTION_{index}") or "").strip()
        if image or caption:
            src = image
            if src and not src.startswith("/"):
                src = f"/challenge/images/{src.lstrip('/')}"
            slides.append({"src": src, "caption": caption or None})
    return slides


def parse_vimeo_id(raw: str) -> str:
    return raw.strip().split("|", 1)[0].strip()


def parse_vimeo_title(raw: str) -> str | None:
    if "|" not in raw:
        return None
    title = raw.split("|", 1)[1].strip()
    return strip_html(title) or None


def strip_html(value: str) -> str:
    text = re.sub(r"<[^>]+>", "", value)
    return decode_entities(text).strip()


def extract_multi_videos(vars_map: dict[str, str]) -> list[dict[str, Any]]:
    videos: list[dict[str, Any]] = []

    declared = int(vars_map.get("VIDEOCOUNT") or "0")
    if declared:
        for index in range(1, max(declared, 20) + 1):
            vimeo_id = (vars_map.get(f"VIMEOID_{index}") or "").strip()
            if not vimeo_id:
                continue
            videos.append(
                {
                    "vimeoId": parse_vimeo_id(vimeo_id),
                    "title": (vars_map.get(f"CAPTION_{index}") or "").strip() or None,
                    "slot": index,
                }
            )
        return videos

    for index in range(1, 21):
        vimeo_id = (vars_map.get(f"VIMEOID{index}") or "").strip()
        if not vimeo_id:
            continue
        label = vars_map.get(f"LABLE{index}") or vars_map.get(f"LABEL{index}") or ""
        title = strip_html(label) if label else parse_vimeo_title(vimeo_id)
        videos.append(
            {
                "vimeoId": parse_vimeo_id(vimeo_id),
                "title": title or None,
                "slot": index,
            }
        )
    return videos


def extract_exercise_sections(
    vars_map: dict[str, str],
) -> list[dict[str, str | None]]:
    sections: list[dict[str, str | None]] = []
    for index in range(1, 21):
        title = (vars_map.get(f"EXCERCISE_TASK_{index}") or "").strip()
        body = (vars_map.get(f"EXCERCISE_DETAILS_{index}") or "").strip()
        icon = (vars_map.get(f"EXCERCISE_ICON_{index}") or "").strip()
        if not title and not body:
            continue
        icon_src = icon or f"/challenge/images/arrow{index}.png"
        if icon_src and not icon_src.startswith("/"):
            icon_src = f"/challenge/images/{icon_src.lstrip('/')}"
        sections.append(
            {
                "title": title or f"Section {index}",
                "bodyHtml": body,
                "iconSrc": icon_src,
            }
        )
    return sections


def migration_fields(vars_map: dict[str, str]) -> dict[str, str]:
    skip = {"FIELDNAMES", "HTMLCONTENT", "TEXTCONTENT"}
    return {k: v for k, v in sorted(vars_map.items()) if k not in skip and v}


def migration_notes(legacy_type: str, vars_map: dict[str, str]) -> list[str]:
    notes = list(MIGRATION_NOTES.get(legacy_type, []))
    if legacy_type == "CustomCFM" and vars_map.get("CUSTOMCFM"):
        notes.insert(0, f"Legacy ColdFusion tool: {vars_map['CUSTOMCFM']}")
    if legacy_type == "Pattern" and vars_map.get("GARMENTTITLE"):
        notes[0] = (
            f"Dynamic pattern generator for garment "
            f"'{vars_map['GARMENTTITLE']}' "
            f"(legacy garmentId {vars_map.get('GARMENTID', '?')})."
        )
    if legacy_type == "DataValidation" and vars_map.get("DATAMODEL_ELEMENTS"):
        notes.insert(
            0,
            f"Validates datamodel field(s): {vars_map['DATAMODEL_ELEMENTS']}",
        )
        if vars_map.get("DATAMODEL_REDIRECT"):
            notes.append(
                f"Redirects to legacy assign {vars_map['DATAMODEL_REDIRECT']} "
                "when validation fails."
            )
    if legacy_type == "DocumentPattern" and vars_map.get("PATTERN_DATAMODEL_ELEMENT"):
        notes.insert(
            1,
            f"Dynamic pattern PDF download from datamodel field "
            f"'{vars_map['PATTERN_DATAMODEL_ELEMENT']}'.",
        )
    return notes


def convert_component(
    row: dict[str, str],
    vars_map: dict[str, str],
    kind: str,
    component_id: int,
    order: int,
) -> list[dict[str, Any]]:
    if kind in SKIP_COMPONENT_TYPES:
        return []

    if kind == "Exercise":
        sections = extract_exercise_sections(vars_map)
        if sections:
            return [
                {
                    "type": "exerciseAccordion",
                    "sections": sections,
                    "legacy": {
                        "showText": vars_map.get("SHOWTEXT") or None,
                        "size": vars_map.get("SIZE") or None,
                    },
                    "legacyComponentId": component_id,
                    "order": order,
                }
            ]
        html = vars_map.get("HTMLCONTENT") or ""
        if html.strip():
            return [
                {
                    "type": "richText",
                    "html": html,
                    "legacyComponentId": component_id,
                    "order": order,
                }
            ]
        return []

    if kind in {"VimeoID", "Video"}:
        vimeo_raw = (vars_map.get("VIMEOID") or "").strip()
        label = strip_html(vars_map.get("LABLE") or vars_map.get("LABEL") or "")
        html = vars_map.get("HTMLCONTENT") or ""
        if vimeo_raw:
            return [
                {
                    "type": "video",
                    "vimeoId": parse_vimeo_id(vimeo_raw),
                    "title": parse_vimeo_title(vimeo_raw) or label or None,
                    "legacyComponentId": component_id,
                    "order": order,
                }
            ]
        if html.strip():
            embedded = extract_vimeo_id(html)
            components = [
                {
                    "type": "richText",
                    "html": strip_embedded_videos(html) if embedded else html,
                    "legacyComponentId": component_id,
                    "order": order,
                }
            ]
            if embedded:
                components.append(
                    {
                        "type": "video",
                        "vimeoId": embedded,
                        "title": label or None,
                        "legacySource": "embedded-html",
                        "legacyComponentId": component_id,
                        "order": order,
                    }
                )
            return components
        return []

    if kind == "Document":
        filename = (vars_map.get("FILENAME") or "").strip()
        if not filename:
            return []
        return [
            {
                "type": "download",
                "label": vars_map.get("LABLE") or vars_map.get("LABEL") or "Download",
                "filename": filename,
                "showInline": vars_map.get("SHOWVIEWER") == "1",
                "legacy": {
                    "assignId": vars_map.get("CHALLENGE_ASSIGNID"),
                    "componentId": vars_map.get("CHALLENGE_COMPONENTID"),
                    "viewHeight": vars_map.get("VIEWHEIGHT"),
                    "icon": vars_map.get("DATAMODEL_ICON"),
                },
                "legacyComponentId": component_id,
                "order": order,
            }
        ]

    if kind == "Imageslideshow":
        slides = extract_slides(vars_map)
        if not slides:
            return []
        return [
            {
                "type": "imageGallery",
                "slides": slides,
                "legacy": {
                    "enableAudio": vars_map.get("ENABLEAUDIO"),
                    "playAudio": vars_map.get("PLAYAUDIO"),
                },
                "legacyComponentId": component_id,
                "order": order,
            }
        ]

    if kind == "VimeoMultiple":
        videos = extract_multi_videos(vars_map)
        return [
            {
                "type": "video",
                "vimeoId": video["vimeoId"],
                "title": video.get("title"),
                "legacySlot": video["slot"],
                "legacyComponentId": component_id,
                "order": order,
            }
            for video in videos
        ]

    if kind in {"CustomCFM", "Pattern", "DataValidation", "DocumentPattern", "Pinterest"}:
        return [
            {
                "type": "migrationPending",
                "legacyType": kind,
                "notes": migration_notes(kind, vars_map),
                "legacyFields": migration_fields(vars_map),
                "legacyComponentId": component_id,
                "order": order,
            }
        ]

    if kind in {"HTML", "Practice"}:
        html = vars_map.get("HTMLCONTENT") or vars_map.get("TEXTCONTENT") or ""
        if html.strip():
            vimeo_id = extract_vimeo_id(html)
            components = [
                {
                    "type": "richText",
                    "html": strip_embedded_videos(html) if vimeo_id else html,
                    "legacyComponentId": component_id,
                    "order": order,
                }
            ]
            if vimeo_id:
                components.append(
                    {
                        "type": "video",
                        "vimeoId": vimeo_id,
                        "title": None,
                        "legacySource": "embedded-html",
                        "legacyComponentId": component_id,
                        "order": order,
                    }
                )
            return components
        return []

    html = vars_map.get("HTMLCONTENT") or vars_map.get("TEXTCONTENT") or ""
    if html.strip():
        vimeo_id = extract_vimeo_id(html)
        components = [
            {
                "type": "richText",
                "html": strip_embedded_videos(html) if vimeo_id else html,
                "legacyComponentId": component_id,
                "order": order,
            }
        ]
        if vimeo_id:
            components.append(
                {
                    "type": "video",
                    "vimeoId": vimeo_id,
                    "title": None,
                    "legacySource": "embedded-html",
                    "legacyComponentId": component_id,
                    "order": order,
                }
            )
        return components

    if vars_map.get("VIMEOID"):
        vimeo_raw = vars_map["VIMEOID"]
        return [
            {
                "type": "video",
                "vimeoId": parse_vimeo_id(vimeo_raw),
                "title": parse_vimeo_title(vimeo_raw)
                or strip_html(vars_map.get("LABLE") or "")
                or None,
                "legacyComponentId": component_id,
                "order": order,
            }
        ]

    if vars_map.get("FILENAME"):
        return [
            {
                "type": "download",
                "label": vars_map.get("LABLE") or "Download",
                "filename": vars_map["FILENAME"],
                "legacyComponentId": component_id,
                "order": order,
            }
        ]

    return [
        {
            "type": "migrationPending",
            "legacyType": kind,
            "notes": [f"Unmapped legacy component type: {kind}"],
            "legacyFields": migration_fields(vars_map),
            "legacyComponentId": component_id,
            "order": order,
        }
    ]


def course_slug(challenge_id: int, title: str) -> str:
    defaults = {
        50: "lk-150-quick-start",
        51: "lk-150-fun",
        34: "master-lk-patterning",
        107: "socks-on-an-lk-150",
    }
    return defaults.get(challenge_id, slugify(title))


def export_filename(challenge_id: int, title: str) -> str:
    overrides = {
        50: "course_50_lk150_quick.csv",
        51: "course_51_lk150_fun.csv",
    }
    if challenge_id in overrides:
        return overrides[challenge_id]
    short = slugify(title).replace("lk-150-", "lk150_").replace("-", "_")
    return f"course_{challenge_id}_{short}.csv"


def poc_filename(challenge_id: int, title: str) -> str:
    overrides = {
        50: "course_50_lk150_quick.poc.json",
        51: "course_51_lk150_fun.poc.json",
    }
    if challenge_id in overrides:
        return overrides[challenge_id]
    short = slugify(title).replace("lk-150-", "lk150_").replace("-", "_")
    return f"course_{challenge_id}_{short}.poc.json"


def build_manifest(lessons: list[dict[str, Any]]) -> dict[str, Any]:
    videos: list[dict[str, Any]] = []
    downloads: list[dict[str, Any]] = []
    seen_videos: set[str] = set()

    for lesson in lessons:
        lesson_slug = lesson["slug"]
        for block in lesson["blocks"]:
            block_slug = block["slug"]
            for component in block["components"]:
                if component["type"] == "video":
                    key = f"{component['vimeoId']}:{lesson_slug}:{block_slug}"
                    if key not in seen_videos:
                        seen_videos.add(key)
                        videos.append(
                            {
                                "vimeoId": component["vimeoId"],
                                "title": component.get("title"),
                                "lessonSlug": lesson_slug,
                                "blockSlug": block_slug,
                            }
                        )
                elif component["type"] == "download":
                    downloads.append(
                        {
                            "filename": component["filename"],
                            "label": component.get("label"),
                            "lessonSlug": lesson_slug,
                            "blockSlug": block_slug,
                        }
                    )

    return {
        "videoCount": len(videos),
        "videos": videos,
        "downloadCount": len(downloads),
        "downloads": downloads,
    }


def import_course(challenge_id: int) -> dict[str, Any]:
    rows = [
        row
        for row in csv.DictReader(CSV_PATH.open(encoding="utf-8-sig"))
        if int(row["ChallengesID"]) == challenge_id
    ]
    if not rows:
        raise SystemExit(f"No rows found for ChallengesID {challenge_id}")

    title = rows[0]["CourseTitle"].strip()
    export_name = export_filename(challenge_id, title)

    lessons_map: dict[int, dict[str, Any]] = {}
    blocks_map: dict[tuple[int, int], dict[str, Any]] = defaultdict(
        lambda: {"components": []}
    )
    pending: list[dict[str, Any]] = []

    for row in rows:
        lesson_id = int(row["Challenge_Item_Id"])
        lesson_order = int(row["LessonOrder"])
        lesson_title = row["LessonTitle"].strip()
        assign_id = int(row["Challenge_AssignID"])
        block_order = int(row["BlockOrder"])
        block_type = row["BlockType"].strip()
        block_title = row["BlockTitle"].strip()
        component_id = int(row["Challenge_componentID"])
        component_order = int(row["ComponentOrder"])
        component_type = row["ComponentType"].strip()

        if lesson_id not in lessons_map:
            lessons_map[lesson_id] = {
                "title": lesson_title,
                "slug": slugify(lesson_title),
                "displayOrder": lesson_order,
                "legacy": {"itemId": lesson_id, "lessonOrder": lesson_order},
                "blocks": [],
            }

        block_key = (lesson_id, assign_id)
        block = blocks_map[block_key]
        if "title" not in block:
            block.update(
                {
                    "title": block_title,
                    "slug": slugify(block_title),
                    "order": block_order,
                    "legacy": {"assignId": assign_id, "blockType": block_type},
                }
            )

        vars_map = parse_wddx(row.get("details") or "")
        kind = effective_type(component_type, vars_map)
        converted = convert_component(
            row, vars_map, kind, component_id, component_order
        )
        if not converted and kind in SKIP_COMPONENT_TYPES:
            continue
        if not converted:
            pending.append(
                {
                    "componentId": component_id,
                    "assignId": assign_id,
                    "lessonId": lesson_id,
                    "kind": kind,
                    "title": block_title,
                }
            )
        block["components"].extend(converted)

    lessons: list[dict[str, Any]] = []
    for lesson_id in sorted(
        lessons_map,
        key=lambda lid: (lessons_map[lid]["displayOrder"], lid),
    ):
        lesson = lessons_map[lesson_id]
        lesson_blocks = [
            blocks_map[(lesson_id, assign_id)]
            for (lid, assign_id) in blocks_map
            if lid == lesson_id and blocks_map[(lid, assign_id)].get("components")
        ]
        lesson_blocks.sort(key=lambda b: (b["order"], b["legacy"]["assignId"]))
        lesson["blocks"] = lesson_blocks
        lessons.append(lesson)

    payload = {
        "schemaVersion": 1,
        "kind": "course-poc",
        "course": {
            "legacyChallengeId": challenge_id,
            "title": title,
            "slug": course_slug(challenge_id, title),
            "legacy": {"sourceExport": export_name},
        },
        "lessons": lessons,
        "manifest": build_manifest(lessons),
    }
    return payload, pending


def write_export_slice(challenge_id: int, title: str) -> None:
    EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
    out_path = EXPORTS_DIR / export_filename(challenge_id, title)
    with CSV_PATH.open(encoding="utf-8-sig", newline="") as src:
        reader = csv.DictReader(src)
        rows = [row for row in reader if int(row["ChallengesID"]) == challenge_id]
    with out_path.open("w", encoding="utf-8", newline="") as dst:
        writer = csv.DictWriter(dst, fieldnames=reader.fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--challenge-id", type=int, required=True)
    args = parser.parse_args()

    payload, pending = import_course(args.challenge_id)
    title = payload["course"]["title"]
    out_path = CLEANED_DIR / poc_filename(args.challenge_id, title)
    write_export_slice(args.challenge_id, title)
    out_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

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
