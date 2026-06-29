"""Tests for legacy course import HTML cleanup."""

from __future__ import annotations

import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))

from legacy_course_import import (
    INTERNAL_REPOSITORY_COURSE_IDS,
    SKIP_CATEGORY_HAND_CLEANED,
    SKIP_CATEGORY_INTERNAL,
    apply_bootstrap_layout_cleanup,
    apply_post_html_cleanup,
    bulk_migration_skip_reason,
    html_to_richtext_components,
    resolve_csv_path,
    try_split_obvious_text_video_layout,
    unwrap_bootstrap_layout_divs,
)

CHALLENGE_ID = 50

# course_50_lk150_quick — practice yarn row (real legacy snippet)
LK150_PRACTICE_ROW = (
    '<center><img class="img-responsive" src="/challenge/images/v2/50/practice_is_not_wasting.gif">'
    "</center><div class=\"row well\"><div class=\"col-sm-3 col-xs-12\">For your practice, choose:"
    "<br><ul><li><span style=\"font-size: 0.85rem;\">Light Color</span></li></ul></div>"
    "<div class=\"col-sm-9 col-xs-12\">We will play with different yarns in another lesson."
    " For now, when you are first starting out we recommend choosing a light color.</div></div>"
)

# course_50_lk150_quick — text + manual PDF (must NOT split into video)
LK150_TEXT_AND_PDF_ROW = (
    '<div class="row"><div class="col-sm-6 col-xs-12">Even if you have a little bit of experience'
    " with your machine, please don't skip this video.</div>"
    '<div class="col-sm-3 col-xs-12"><a href="/challenge/images/v2/50/lk-150KIN.pdf">'
    '<figure><img class="img-responsive" src="/challenge/images/v2/50/lk_150_cover_200.jpg">'
    "<figcaption align=\"left\"><br>Print the manual</figcaption></figure></a></div></div>"
)

# course_50_lk150_quick — accordion body with embedded Vimeo (cleanup only)
LK150_ACCORDION_VIDEO_BODY = (
    '<div class="row">    <div class="col-sm-6 col-xs-12">        '
    "Taking the carriage too far past the edge of the knitting can cause loops."
    '    </div>    <div class="col-sm-6 col-xs-12">        '
    "<div class='embed-video-container'><iframe src='https://player.vimeo.com/video/342110904' "
    "frameborder='0' webkitAllowFullScreen mozallowfullscreen allowFullScreen></iframe></div>    "
    "</div></div>"
)

# Unambiguous two-column text + Vimeo (synthetic, matches common legacy pattern)
TWO_COLUMN_TEXT_VIDEO = (
    '<div class="row"><div class="col-sm-6 col-xs-12"><p>Watch this technique closely.</p></div>'
    '<div class="col-sm-6 col-xs-12"><div class=\'embed-video-container\'>'
    "<iframe src='https://player.vimeo.com/video/342110904' frameborder='0'></iframe>"
    "</div></div></div>"
)

# course_129_watch_cap_beanie — well_white wrapper (real pattern)
WELL_WHITE_ROW = (
    '<div class="well_white"><div class="row"><div class="col-sm-6 col-xs-12">'
    "<h3>Make sure it stays on!</h3>When knitting sweaters, we add ease."
    '</div><div class="col-sm-6 col-xs-12"><img class="img-thumbnail" '
    'src="/challenge/images/v2/129/watch_cap_thumb.jpg"></div></div></div>'
)


class BootstrapLayoutCleanupTests(unittest.TestCase):
    def test_unwraps_row_and_column_divs_preserving_content(self) -> None:
        cleaned = apply_bootstrap_layout_cleanup(LK150_PRACTICE_ROW)
        self.assertNotIn("col-sm-3", cleaned)
        self.assertNotIn("col-sm-9", cleaned)
        self.assertNotIn("img-responsive", cleaned)
        self.assertIn("For your practice, choose:", cleaned)
        self.assertIn("We will play with different yarns", cleaned)
        self.assertIn("practice_is_not_wasting.gif", cleaned)

    def test_strips_img_responsive_class(self) -> None:
        cleaned = apply_bootstrap_layout_cleanup(
            '<img class="img-responsive img-thumbnail" src="/challenge/images/v2/50/a.jpg">'
        )
        self.assertIn('class="img-thumbnail"', cleaned)
        self.assertNotIn("img-responsive", cleaned)

    def test_unwraps_well_and_well_white(self) -> None:
        cleaned = apply_bootstrap_layout_cleanup(WELL_WHITE_ROW)
        self.assertNotIn("well_white", cleaned)
        self.assertNotIn("class=\"row\"", cleaned)
        self.assertIn("Make sure it stays on!", cleaned)
        self.assertIn("watch_cap_thumb.jpg", cleaned)

    def test_accordion_body_cleanup_does_not_remove_iframe(self) -> None:
        cleaned = apply_post_html_cleanup(LK150_ACCORDION_VIDEO_BODY, CHALLENGE_ID)
        self.assertNotIn("col-sm-6", cleaned)
        self.assertIn("342110904", cleaned)
        self.assertIn("Taking the carriage too far", cleaned)

    def test_text_and_pdf_row_stays_single_richtext(self) -> None:
        split = try_split_obvious_text_video_layout(LK150_TEXT_AND_PDF_ROW)
        self.assertIsNone(split)
        components = html_to_richtext_components(
            LK150_TEXT_AND_PDF_ROW,
            CHALLENGE_ID,
            4863,
            1,
            allow_obvious_text_video_split=True,
        )
        self.assertEqual(len(components), 1)
        self.assertEqual(components[0]["type"], "richText")
        self.assertIn("Print the manual", components[0]["html"])
        self.assertNotIn("col-sm-6", components[0]["html"])


class ObviousTextVideoSplitTests(unittest.TestCase):
    def test_splits_unambiguous_two_column_layout(self) -> None:
        split = try_split_obvious_text_video_layout(TWO_COLUMN_TEXT_VIDEO)
        self.assertIsNotNone(split)
        text_html, vimeo_id = split
        self.assertEqual(vimeo_id, "342110904")
        self.assertIn("Watch this technique closely", text_html)
        self.assertNotIn("iframe", text_html)

    def test_html_to_components_splits_only_when_unambiguous(self) -> None:
        components = html_to_richtext_components(
            TWO_COLUMN_TEXT_VIDEO,
            CHALLENGE_ID,
            100,
            1,
            allow_obvious_text_video_split=True,
        )
        self.assertEqual(len(components), 2)
        self.assertEqual(components[0]["type"], "richText")
        self.assertEqual(components[1]["type"], "video")
        self.assertEqual(components[1]["vimeoId"], "342110904")
        self.assertNotIn("iframe", components[0]["html"])

    def test_three_column_layout_is_not_split(self) -> None:
        html = (
            '<div class="row"><div class="col-sm-4 col-xs-12">A</div>'
            '<div class="col-sm-4 col-xs-12">'
            "<iframe src='https://player.vimeo.com/video/111'></iframe></div>"
            '<div class="col-sm-4 col-xs-12">C</div></div>'
        )
        self.assertIsNone(try_split_obvious_text_video_layout(html))


class UnwrapBootstrapLayoutDivsTests(unittest.TestCase):
    def test_nested_row_columns_unwrap_inward(self) -> None:
        html = (
            '<div class="row"><div class="col-sm-6 col-xs-12">Left</div>'
            '<div class="col-sm-6 col-xs-12">Right</div></div>'
        )
        cleaned = unwrap_bootstrap_layout_divs(html)
        self.assertEqual(cleaned, "LeftRight")


class BulkMigrationSkipTests(unittest.TestCase):
    def test_course_65_is_internal_repository(self) -> None:
        self.assertIn(65, INTERNAL_REPOSITORY_COURSE_IDS)

    def test_internal_repository_always_skipped(self) -> None:
        skip = bulk_migration_skip_reason(65, poc_file_exists=False)
        self.assertIsNotNone(skip)
        self.assertEqual(skip["category"], SKIP_CATEGORY_INTERNAL)
        self.assertEqual(skip["reason"], "Skipped (internal repository)")

    def test_hand_cleaned_skipped_only_when_poc_exists(self) -> None:
        self.assertIsNone(
            bulk_migration_skip_reason(50, poc_file_exists=False),
        )
        skip = bulk_migration_skip_reason(50, poc_file_exists=True)
        self.assertIsNotNone(skip)
        self.assertEqual(skip["category"], SKIP_CATEGORY_HAND_CLEANED)

    def test_hand_cleaned_can_be_overwritten(self) -> None:
        self.assertIsNone(
            bulk_migration_skip_reason(
                51,
                poc_file_exists=True,
                overwrite_hand_cleaned=True,
            ),
        )


class MigrateAllDryRunTests(unittest.TestCase):
    def test_dry_run_skips_course_65_and_reports_categories(self) -> None:
        from migrate_all_legacy_courses import migrate_all

        csv_path = resolve_csv_path()
        report = migrate_all(csv_path=csv_path, dry_run=True, write_exports=False)

        migrated_ids = {
            course["legacyChallengeId"] for course in report["courses"]
        }
        self.assertNotIn(65, migrated_ids)
        self.assertEqual(report["totals"]["coursesSkippedInternal"], 1)
        self.assertEqual(report["totals"]["coursesSkippedHandCleaned"], 2)
        self.assertEqual(report["totals"]["coursesSkipped"], 3)
        self.assertEqual(report["totals"]["missingContent"], 0)

        internal = report["skippedInternalCourses"]
        self.assertEqual(len(internal), 1)
        self.assertEqual(internal[0]["legacyChallengeId"], 65)
        self.assertEqual(internal[0]["reason"], "Skipped (internal repository)")

        hand_cleaned_ids = {
            item["legacyChallengeId"]
            for item in report["skippedHandCleanedCourses"]
        }
        self.assertEqual(hand_cleaned_ids, {50, 51})


if __name__ == "__main__":
    unittest.main()
