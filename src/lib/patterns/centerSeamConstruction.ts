/**
 * Shared center-seam capacity and split math.
 *
 * Set-In Sleeve is the only builder that turns this on. Sleeveless and Drop Shoulder
 * can call the same split later; they do not read `style.centerSeams` yet.
 *
 * Seam stitch: one extra stitch on each new center edge (pullover front and back,
 * cardigan back). It is included in the hem, bust, and stitches after the armhole,
 * and it is bound off at the start of that edge's neckline. Finished garment width
 * does not include it. Cardigan fronts are already the opening, so they do not get
 * another seam stitch.
 */

import { splitBodyBackCastOnToSymmetricCardiganHalves } from "./cardiganFrontBlock";

export const CENTER_SEAMS_STYLE_KEY = "centerSeams";

export function readCenterSeams(style: unknown): boolean {
  if (!style || typeof style !== "object") return false;
  return (style as Record<string, unknown>)[CENTER_SEAMS_STYLE_KEY] === true;
}

export type CenterSeamPieceNeed = {
  id: string;
  label: string;
  requiredNeedles: number;
};

export type CenterSeamCapacity = {
  availableNeedles: number | null;
  /** Pieces as written before any added center seam. */
  pieces: CenterSeamPieceNeed[];
  /** Pieces that would be knitted after the center-seam split, including seam stitches. */
  seamedPieces: CenterSeamPieceNeed[];
  fitsAsWritten: boolean;
  seamsFit: boolean;
  /** True only when the written pieces do not fit and every seamed piece, including sleeves, does. */
  offerSeams: boolean;
  shouldBlock: boolean;
  seamBlockReason: string | null;
};

function positive(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

function peak(hem: number, bust: number): number {
  return Math.max(0, Math.floor(hem), Math.floor(bust));
}

/** Left receives the extra stitch when the width is odd, matching the cardigan front split. */
export function centerSeamHalfStitches(fullWidth: number, side: "left" | "right", seamStitch: boolean): number {
  const split = splitBodyBackCastOnToSymmetricCardiganHalves(fullWidth);
  const half = side === "left" ? split.leftFrontWidthSts : split.rightFrontWidthSts;
  return half + (seamStitch ? 1 : 0);
}

export function assessSetInSleeveNeedleCapacity(input: {
  availableNeedles: number | null | undefined;
  cardigan: boolean;
  centerSeamsAccepted: boolean;
  backHem: number;
  backBust: number;
  /** Existing cardigan front, already a half. Ignored for pullovers. */
  cardiganFrontHem?: number;
  cardiganFrontBust?: number;
  sleeveNeedles: number;
}): CenterSeamCapacity {
  const available = positive(input.availableNeedles);
  const backNeed = peak(input.backHem, input.backBust);
  const frontNeed = input.cardigan
    ? peak(input.cardiganFrontHem ?? 0, input.cardiganFrontBust ?? 0)
    : backNeed;
  const sleeveNeed = Math.max(0, Math.floor(input.sleeveNeedles));
  const pieces: CenterSeamPieceNeed[] = [
    { id: "back", label: input.cardigan ? "Back" : "Back", requiredNeedles: backNeed },
    { id: "front", label: input.cardigan ? "Front" : "Front", requiredNeedles: frontNeed },
    { id: "sleeve", label: "Sleeve", requiredNeedles: sleeveNeed },
  ].filter((piece) => piece.requiredNeedles > 0);

  const seamedBack = (["left", "right"] as const).map((side) => ({
    id: `back-${side}`,
    label: side === "left" ? "First Back Half" : "Second Back Half",
    requiredNeedles: peak(
      centerSeamHalfStitches(input.backHem, side, true),
      centerSeamHalfStitches(input.backBust, side, true),
    ),
  }));
  const seamedFront = input.cardigan
    ? [
        {
          id: "front",
          label: "Front",
          requiredNeedles: frontNeed,
        },
      ]
    : (["left", "right"] as const).map((side) => ({
        id: `front-${side}`,
        label: side === "left" ? "First Front Half" : "Second Front Half",
        requiredNeedles: peak(
          centerSeamHalfStitches(input.backHem, side, true),
          centerSeamHalfStitches(input.backBust, side, true),
        ),
      }));
  const seamedPieces = [...seamedBack, ...seamedFront, { id: "sleeve", label: "Sleeve", requiredNeedles: sleeveNeed }].filter(
    (piece) => piece.requiredNeedles > 0,
  );

  const knownLimit = available !== null;
  const fitsAsWritten = !knownLimit || pieces.every((piece) => piece.requiredNeedles <= available);
  const seamsFit = !knownLimit || seamedPieces.every((piece) => piece.requiredNeedles <= available);
  const offerSeams = knownLimit && !fitsAsWritten && seamsFit;
  const shouldBlock = knownLimit && ((!input.centerSeamsAccepted && !fitsAsWritten) || (input.centerSeamsAccepted && !seamsFit));

  const over = seamedPieces.filter((piece) => knownLimit && piece.requiredNeedles > (available as number));
  let seamBlockReason: string | null = null;
  if (knownLimit && !seamsFit) {
    const sleeve = over.find((piece) => piece.id === "sleeve");
    if (sleeve) {
      seamBlockReason = `The sleeve requires ${sleeve.requiredNeedles} needles. This machine has ${available} available. Added center seams do not change the sleeve.`;
    } else if (over.length > 0) {
      const list = over.map((piece) => `${piece.label} still requires ${piece.requiredNeedles} needles`).join("; ");
      seamBlockReason = `${list}. This machine has ${available} available, so added center seams still do not fit.`;
    }
  }

  return {
    availableNeedles: available,
    pieces,
    seamedPieces,
    fitsAsWritten,
    seamsFit,
    offerSeams,
    shouldBlock,
    seamBlockReason,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Capacity card for Set-In Sleeve only. Other builders keep the shared hard-stop card. */
export function buildSetInSleeveNeedleCapacityHtml(
  capacity: CenterSeamCapacity,
  adjustHref: string,
): string {
  const available = capacity.availableNeedles ?? 0;
  const over = capacity.centerSeamsAccepted ? capacity.seamedPieces : capacity.pieces;
  const lines = over
    .filter((piece) => piece.requiredNeedles > available)
    .map(
      (piece) =>
        `<li>The ${escapeHtml(piece.label.toLowerCase())} requires <strong>${piece.requiredNeedles}</strong> needles. Your machine has <strong>${available}</strong> available.</li>`,
    );
  const reason = capacity.seamBlockReason
    ? `<p class="express-needle-hard-stop__body">${escapeHtml(capacity.seamBlockReason)}</p>`
    : "";
  const seamButton = capacity.offerSeams
    ? `<button type="button" class="kbm-btn kbm-btn-accent express-needle-hard-stop__btn" data-set-in-center-seams="continue">Continue with added seams</button>`
    : "";
  const href = escapeHtml(adjustHref.trim() || "/patterns/set-in-sleeve/builder");
  return `<section class="express-needle-hard-stop" role="alert" data-set-in-needle-capacity>
  <h2 class="express-needle-hard-stop__title">This pattern is too wide for your machine</h2>
  <ul class="express-needle-hard-stop__list">${lines.join("")}</ul>
  ${reason}
  <p class="express-needle-hard-stop__body">You can also knit this sweater by hand.</p>
  <p class="express-needle-hard-stop__actions">
    ${seamButton}
    <a href="${href}" class="kbm-btn kbm-btn-accent express-needle-hard-stop__btn">Go back and change my settings</a>
  </p>
</section>`;
}
