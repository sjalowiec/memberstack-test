"""
Shared legacy KIN course CSV → course-poc JSON conversion.

Used by import_lk150_course_poc.py (single course) and migrate_all_legacy_courses.py (bulk).
"""

from __future__ import annotations

import csv
import json
import re
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[3]
EXPORTS_DIR = ROOT / "src/data/legacy_kin/exports"
CLEANED_DIR = ROOT / "src/data/legacy_kin/cleaned"
RAW_DIR = ROOT / "src/data/legacy_kin/raw"
REPORTS_DIR = ROOT / "src/data/legacy_kin/reports"
BACKUP_DIR = CLEANED_DIR / "backups"

HAND_CLEANED_COURSE_IDS = {50, 51}

CSV_CANDIDATE_PATHS = (
    ROOT / "data/legacy_kin/exports/kin-all-legacy-courses-content.csv",
    ROOT / "src/data/legacy_kin/exports/kin-all-legacy-courses-content.csv",
    ROOT / "data/KIN lk150 courses.csv",
)

ALL_COURSES_CSV_NAMES = {
    "kin-all-legacy-courses-content.csv",
}

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

HTML_CLEANUP_ACTIONS = (
    "emptyParagraphs",
    "duplicateBreaks",
    "fontFamily",
    "legacyNav",
    "vimeoSpacing",
    "boxWrappers",
)

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


def resolve_csv_path(explicit: Path | None = None) -> Path:
    if explicit is not None:
        if not explicit.exists():
            raise FileNotFoundError(f"CSV not found: {explicit}")
        return explicit
    for path in CSV_CANDIDATE_PATHS:
        if path.exists():
            return path
    raise FileNotFoundError(
        "Legacy course CSV not found. Expected one of:\n"
        + "\n".join(f"  - {path}" for path in CSV_CANDIDATE_PATHS)
    )


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


def strip_html(value: str) -> str:
    text = re.sub(r"<[^>]+>", "", value)
    return decode_entities(text).strip()


def parse_vimeo_id(raw: str) -> str:
    return raw.strip().split("|", 1)[0].strip()


def parse_vimeo_title(raw: str) -> str | None:
    if "|" not in raw:
        return None
    title = raw.split("|", 1)[1].strip()
    return strip_html(title) or None


def rewrite_challenge_image_path(path: str, challenge_id: int) -> str:
    trimmed = path.strip()
    if not trimmed:
        return trimmed
    if trimmed.startswith("/challenge/images/v2/"):
        return trimmed
    if re.match(r"^https?://", trimmed, re.IGNORECASE):
        match = re.search(
            r"/challenge/images/(?:v2/\d+/)?(.+)$",
            trimmed,
            re.IGNORECASE,
        )
        if match:
            return f"/challenge/images/v2/{challenge_id}/{match.group(1)}"
        return trimmed
    if trimmed.startswith("//"):
        return rewrite_challenge_image_path(f"https:{trimmed}", challenge_id)
    if trimmed.startswith("/challenge/images/"):
        remainder = trimmed[len("/challenge/images/") :]
        if remainder.startswith("v2/"):
            return trimmed
        return f"/challenge/images/v2/{challenge_id}/{remainder.lstrip('/')}"
    if trimmed.startswith("/"):
        return trimmed
    return f"/challenge/images/v2/{challenge_id}/{trimmed.lstrip('/')}"


def rewrite_download_reference(value: str) -> str:
    trimmed = value.strip()
    if not trimmed:
        return trimmed
    if trimmed.startswith("/downloads/"):
        return trimmed
    basename = trimmed.rsplit("/", 1)[-1]
    if not basename.lower().endswith(".pdf"):
        return trimmed
    if re.match(r"^https?://", trimmed, re.IGNORECASE):
        if "knititnow.com" not in trimmed.lower():
            return trimmed
        return f"/downloads/{basename}"
    if "KIN_Images/Challenges" in trimmed or "kin_images/challenges" in trimmed.lower():
        return f"/downloads/{basename}"
    if trimmed.startswith("/") and trimmed.lower().endswith(".pdf"):
        return f"/downloads/{basename}"
    if not trimmed.startswith("/") and trimmed.lower().endswith(".pdf"):
        return f"/downloads/{trimmed}"
    return trimmed


def rewrite_html_image_paths(html: str, challenge_id: int) -> str:
    def repl_src(match: re.Match[str]) -> str:
        prefix, quote, path = match.group(1), match.group(2), match.group(3)
        return f"{prefix}{quote}{rewrite_challenge_image_path(path, challenge_id)}{quote}"

    return re.sub(
        r'(\ssrc=)(["\'])([^"\']+)\2',
        repl_src,
        html,
        flags=re.IGNORECASE,
    )


def rewrite_html_download_links(html: str) -> str:
    def repl_href(match: re.Match[str]) -> str:
        prefix, quote, path = match.group(1), match.group(2), match.group(3)
        if not path.lower().endswith(".pdf"):
            return match.group(0)
        return f"{prefix}{quote}{rewrite_download_reference(path)}{quote}"

    return re.sub(
        r'(\shref=)(["\'])([^"\']+)\2',
        repl_href,
        html,
        flags=re.IGNORECASE,
    )


def apply_html_cleanup(html: str, actions: tuple[str, ...] | None = None) -> str:
    selected = actions or HTML_CLEANUP_ACTIONS
    result = html
    for action in selected:
        if action == "emptyParagraphs":
            result = re.sub(
                r"<p\b[^>]*>(?:\s|&nbsp;|<br\s*/?>)*</p>",
                "",
                result,
                flags=re.IGNORECASE,
            )
        elif action == "duplicateBreaks":
            result = re.sub(r"(<br\s*/?>\s*){2,}", "<br>", result, flags=re.IGNORECASE)
        elif action == "fontFamily":
            result = (
                re.sub(r"\s*font-family\s*:\s*[^;\"']+;?", "", result, flags=re.IGNORECASE)
                .replace(' style=""', "")
                .replace(" style=''", "")
            )
        elif action == "legacyNav":
            result = re.sub(
                r"<a\b[^>]*class=\"[^\"]*\bbtn\b[^\"]*\"[^>]*>[\s\S]*?</a>",
                "",
                result,
                flags=re.IGNORECASE,
            )
            result = re.sub(
                r"<div\b[^>]*class=\"[^\"]*\b(?:nav|navigation|pager|pagination)\b[^\"]*\"[^>]*>[\s\S]*?</div>",
                "",
                result,
                flags=re.IGNORECASE,
            )
        elif action == "vimeoSpacing":
            result = re.sub(
                r"\s*(<iframe\b[^>]*(?:vimeo|player\.vimeo)[^>]*></iframe>)\s*",
                r"\n\1\n",
                result,
                flags=re.IGNORECASE,
            )
            result = re.sub(
                r"(</iframe>)\s+(<iframe\b)",
                r"\1\n\2",
                result,
                flags=re.IGNORECASE,
            )
        elif action == "boxWrappers":
            result = re.sub(
                r"</?div\b[^>]*class=\"[^\"]*\bboxtop\b[^\"]*\"[^>]*>",
                "",
                result,
                flags=re.IGNORECASE,
            )
            result = re.sub(
                r"</?div\b[^>]*class=\"[^\"]*\bboxbottom\b[^\"]*\"[^>]*>",
                "",
                result,
                flags=re.IGNORECASE,
            )
    return result


def extract_slides(
    vars_map: dict[str, str], challenge_id: int
) -> list[dict[str, str | None]]:
    slides: list[dict[str, str | None]] = []
    for index in range(40):
        image = (vars_map.get(f"SLIDESHOWIMAGE_{index}") or "").strip()
        caption = (vars_map.get(f"SLIDESHOWCAPTION_{index}") or "").strip()
        if image or caption:
            src = rewrite_challenge_image_path(image, challenge_id) if image else ""
            slides.append({"src": src, "caption": caption or None})
    return slides


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
    vars_map: dict[str, str], challenge_id: int
) -> list[dict[str, str | None]]:
    sections: list[dict[str, str | None]] = []
    for index in range(1, 21):
        title = (vars_map.get(f"EXCERCISE_TASK_{index}") or "").strip()
        body = (vars_map.get(f"EXCERCISE_DETAILS_{index}") or "").strip()
        icon = (vars_map.get(f"EXCERCISE_ICON_{index}") or "").strip()
        if not title and not body:
            continue
        icon_src = icon or f"/challenge/images/arrow{index}.png"
        sections.append(
            {
                "title": title or f"Section {index}",
                "bodyHtml": apply_post_html_cleanup(body, challenge_id),
                "iconSrc": rewrite_challenge_image_path(icon_src, challenge_id),
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


def apply_post_html_cleanup(html: str, challenge_id: int) -> str:
    cleaned = apply_html_cleanup(html)
    cleaned = rewrite_html_image_paths(cleaned, challenge_id)
    cleaned = rewrite_html_download_links(cleaned)
    return cleaned


def convert_component(
    row: dict[str, str],
    vars_map: dict[str, str],
    kind: str,
    component_id: int,
    order: int,
    challenge_id: int,
) -> list[dict[str, Any]]:
    if kind in SKIP_COMPONENT_TYPES:
        return []

    if kind == "Exercise":
        sections = extract_exercise_sections(vars_map, challenge_id)
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
                    "html": apply_post_html_cleanup(html, challenge_id),
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
                    "html": apply_post_html_cleanup(
                        strip_embedded_videos(html) if embedded else html,
                        challenge_id,
                    ),
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
                "filename": rewrite_download_reference(filename),
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
        slides = extract_slides(vars_map, challenge_id)
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
                    "html": apply_post_html_cleanup(
                        strip_embedded_videos(html) if vimeo_id else html,
                        challenge_id,
                    ),
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
                "html": apply_post_html_cleanup(
                    strip_embedded_videos(html) if vimeo_id else html,
                    challenge_id,
                ),
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
                "filename": rewrite_download_reference(vars_map["FILENAME"]),
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


def raw_archive_filename(challenge_id: int, title: str) -> str:
    return poc_filename(challenge_id, title).replace(".poc.json", ".raw.json")


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


def collect_course_stats(
    payload: dict[str, Any], pending: list[dict[str, Any]]
) -> dict[str, Any]:
    image_refs: list[str] = []
    download_refs: list[str] = []
    missing_titles: list[dict[str, Any]] = []
    missing_content: list[dict[str, Any]] = []

    for lesson in payload["lessons"]:
        if not (lesson.get("title") or "").strip():
            missing_titles.append(
                {"kind": "lesson", "legacyItemId": lesson["legacy"]["itemId"]}
            )
        if not lesson.get("blocks"):
            missing_content.append(
                {
                    "kind": "lesson",
                    "legacyItemId": lesson["legacy"]["itemId"],
                    "reason": "no blocks",
                }
            )
        for block in lesson.get("blocks", []):
            if not (block.get("title") or "").strip():
                missing_titles.append(
                    {
                        "kind": "block",
                        "legacyAssignId": block["legacy"]["assignId"],
                        "lessonItemId": lesson["legacy"]["itemId"],
                    }
                )
            if not block.get("components"):
                missing_content.append(
                    {
                        "kind": "block",
                        "legacyAssignId": block["legacy"]["assignId"],
                        "lessonItemId": lesson["legacy"]["itemId"],
                        "reason": "no components",
                    }
                )
            for component in block.get("components", []):
                if component["type"] == "richText":
                    html = component.get("html") or ""
                    if not html.strip():
                        missing_content.append(
                            {
                                "kind": "richText",
                                "legacyComponentId": component["legacyComponentId"],
                                "legacyAssignId": block["legacy"]["assignId"],
                            }
                        )
                    for match in re.finditer(
                        r'(?:src|href)=["\']([^"\']+)["\']',
                        html,
                        re.IGNORECASE,
                    ):
                        ref = match.group(1)
                        if "/challenge/images/" in ref or "challenge/images" in ref.lower():
                            image_refs.append(ref)
                        if ref.lower().endswith(".pdf") or "/downloads/" in ref:
                            download_refs.append(ref)
                elif component["type"] == "imageGallery":
                    for slide in component.get("slides", []):
                        src = slide.get("src") or ""
                        if src:
                            image_refs.append(src)
                elif component["type"] == "exerciseAccordion":
                    for section in component.get("sections", []):
                        icon = section.get("iconSrc") or ""
                        if icon:
                            image_refs.append(icon)
                elif component["type"] == "download":
                    filename = component.get("filename") or ""
                    if filename:
                        download_refs.append(filename)

    return {
        "lessonCount": len(payload["lessons"]),
        "blockCount": sum(len(lesson.get("blocks", [])) for lesson in payload["lessons"]),
        "pendingComponents": pending,
        "missingTitles": missing_titles,
        "missingContent": missing_content,
        "imageReferences": sorted(set(image_refs)),
        "downloadReferences": sorted(set(download_refs)),
    }


def parse_int_field(value: str | None, field_name: str) -> int | None:
    if value is None:
        return None
    trimmed = value.strip()
    if not trimmed or trimmed.upper() == "NULL":
        return None
    return int(trimmed)


def import_course_rows(
    challenge_id: int,
    rows: list[dict[str, str]],
    *,
    source_export: str,
    source_csv: str,
) -> tuple[
    dict[str, Any],
    list[dict[str, Any]],
    list[dict[str, Any]],
    list[dict[str, Any]],
]:
    if not rows:
        raise ValueError(f"No rows found for ChallengesID {challenge_id}")

    title = rows[0]["CourseTitle"].strip()
    lessons_map: dict[int, dict[str, Any]] = {}
    blocks_map: dict[tuple[int, int], dict[str, Any]] = defaultdict(
        lambda: {"components": []}
    )
    pending: list[dict[str, Any]] = []
    raw_components: list[dict[str, Any]] = []
    skipped_rows: list[dict[str, Any]] = []

    for row in rows:
        lesson_id = parse_int_field(row.get("Challenge_Item_Id"), "Challenge_Item_Id")
        lesson_order = parse_int_field(row.get("LessonOrder"), "LessonOrder")
        assign_id = parse_int_field(row.get("Challenge_AssignID"), "Challenge_AssignID")
        block_order = parse_int_field(row.get("BlockOrder"), "BlockOrder")
        component_id = parse_int_field(
            row.get("Challenge_componentID"), "Challenge_componentID"
        )
        component_order = parse_int_field(row.get("ComponentOrder"), "ComponentOrder")

        if (
            lesson_id is None
            or lesson_order is None
            or assign_id is None
            or block_order is None
            or component_id is None
            or component_order is None
        ):
            skipped_rows.append(
                {
                    "lessonItemId": row.get("Challenge_Item_Id"),
                    "assignId": row.get("Challenge_AssignID"),
                    "componentId": row.get("Challenge_componentID"),
                    "blockTitle": row.get("BlockTitle"),
                    "componentType": row.get("ComponentType"),
                    "reason": "missing required legacy ids",
                }
            )
            continue

        lesson_title = row["LessonTitle"].strip()
        assign_id = int(assign_id)
        block_order = int(block_order)
        component_id = int(component_id)
        component_order = int(component_order)
        lesson_id = int(lesson_id)
        lesson_order = int(lesson_order)
        block_type = (row.get("BlockType") or "").strip()
        block_title = (row.get("BlockTitle") or "").strip()
        component_type = (row.get("ComponentType") or "").strip()

        raw_wddx = row.get("details") or ""

        raw_components.append(
            {
                "lessonItemId": lesson_id,
                "lessonOrder": lesson_order,
                "lessonTitle": lesson_title,
                "assignId": assign_id,
                "blockOrder": block_order,
                "blockType": block_type,
                "blockTitle": block_title,
                "componentId": component_id,
                "componentOrder": component_order,
                "componentType": component_type,
                "rawWddx": raw_wddx,
            }
        )

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

        vars_map = parse_wddx(raw_wddx)
        kind = effective_type(component_type, vars_map)
        converted = convert_component(
            row, vars_map, kind, component_id, component_order, challenge_id
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

    migrated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    payload = {
        "schemaVersion": 1,
        "kind": "course-poc",
        "course": {
            "legacyChallengeId": challenge_id,
            "title": title,
            "slug": course_slug(challenge_id, title),
            "status": "draft",
            "published": False,
            "legacy": {
                "sourceExport": source_export,
                "sourceCsv": source_csv,
                "migratedAt": migrated_at,
            },
        },
        "lessons": lessons,
        "manifest": build_manifest(lessons),
    }
    return payload, pending, raw_components, skipped_rows


def load_csv_rows(csv_path: Path) -> list[dict[str, str]]:
    with csv_path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def group_rows_by_course(rows: list[dict[str, str]]) -> dict[int, list[dict[str, str]]]:
    grouped: dict[int, list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        grouped[int(row["ChallengesID"])].append(row)
    return dict(grouped)


def backup_existing_file(path: Path) -> Path | None:
    if not path.exists():
        return None
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%dT%H%M%S")
    backup_path = BACKUP_DIR / f"{path.name}.{stamp}.bak.json"
    backup_path.write_bytes(path.read_bytes())
    return backup_path


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
