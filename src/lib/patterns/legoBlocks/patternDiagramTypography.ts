/**
 * Shared finished-pattern diagram type.
 *
 * Canonical sizes are the Drop Shoulder / Sleeveless diagram sizes on the
 * 430-wide viewBox: stitch and shaping notation 17, row measurement and RC 14,
 * piece title 13, instruction note 9, notation line gap 18.
 * Font user-units scale with the viewBox width so an SVG at `width: 100%`
 * matches that on-screen size. The silhouette is not scaled.
 */

import {
  DS_FS_MEASURE,
  DS_FS_TITLE,
  DS_FW_TITLE,
  DS_VB_W,
} from "../dropShoulderPatternDiagramSvgShared";
import {
  DS_FS_NOTATION,
  DS_FS_RC,
  DS_NOTATION_GAP,
} from "../dropShoulderShapingNotationDiagramShared";

export type SidewaysPatternDiagramType = {
  /** Width the sizes were resolved against. */
  viewBoxWidth: number;
  stitch: number;
  row: number;
  piece: number;
  pieceWeight: number;
  /** Instruction note, smaller than piece titles and measurement values. */
  note: number;
  notation: number;
  notationGap: number;
  /** Row-counter reading. Same canonical size as the sweater RC label. */
  rc: number;
};

/**
 * Resolve finished-pattern type for one diagram canvas.
 * Sideways, Socks, and Christmas Stocking all use this block.
 */
export function sidewaysPatternDiagramTypography(viewBoxWidth: number): SidewaysPatternDiagramType {
  const width = viewBoxWidth > 0 ? viewBoxWidth : DS_VB_W;
  const scale = width / DS_VB_W;
  const px = (canonical: number) => Math.max(1, Math.round(canonical * scale));
  return {
    viewBoxWidth: width,
    stitch: px(DS_FS_NOTATION),
    row: px(DS_FS_MEASURE),
    piece: px(DS_FS_TITLE),
    pieceWeight: DS_FW_TITLE,
    note: px(9),
    notation: px(DS_FS_NOTATION),
    notationGap: px(DS_NOTATION_GAP),
    rc: px(DS_FS_RC),
  };
}
