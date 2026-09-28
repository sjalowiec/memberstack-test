import type { CourseComponent } from "./coursePreviewPoc";
import {
  isVimeoJumpLinksType,
  jumpsFromComponent,
  normalizeVimeoId,
  syncJumpLegacyFields,
  type VimeoJump,
} from "../kinCourse/vimeoJumpLinks";

export type NativeVimeoJumpLinksComponent = {
  type: "vimeoJumpLinks";
  vimeoId?: string | null;
  playerComponentId?: number | null;
  jumps: VimeoJump[];
  legacyComponentId: number;
  order: number;
  legacyFields?: Record<string, string>;
  notes?: string[];
};

export function isVimeoJumpLinksComponent(component: unknown): boolean {
  if (!component || typeof component !== "object" || Array.isArray(component)) return false;
  const record = component as Record<string, unknown>;
  return isVimeoJumpLinksType(record.type, record.legacyType);
}

type JumpLinkAssociable = {
  type?: unknown;
  legacyType?: unknown;
  legacyComponentId?: unknown;
  legacySlot?: unknown;
  vimeoId?: unknown;
  playerComponentId?: unknown;
  order?: unknown;
};

/** Preview order: component order, then slot. A full tie keeps the stored list. */
export function componentsInPreviewOrder<T extends JumpLinkAssociable>(components: T[]): T[] {
  return [...components].sort((a, b) => {
    const orderA = Number(a.order ?? 0);
    const orderB = Number(b.order ?? 0);
    if (orderA !== orderB) return orderA - orderB;
    const slotA = Number(a.legacySlot ?? 0);
    const slotB = Number(b.legacySlot ?? 0);
    if (slotA !== slotB) return slotA - slotB;
    return 0;
  });
}

/**
 * Jump links belong to a video only inside the same component list.
 * An explicit player id or Vimeo id wins. Otherwise the nearest preceding
 * video owns them. There is no fallback to a later or unrelated video.
 * Legacy CHALLENGE_COMPONENTID is not a video reference.
 */
export function videoIndexOwningJumpLinks(
  components: JumpLinkAssociable[],
  jumpIndex: number,
): number | null {
  const jump = components[jumpIndex];
  if (!jump || !isVimeoJumpLinksComponent(jump)) return null;

  const explicitPlayerId = Number(jump.playerComponentId);
  if (Number.isFinite(explicitPlayerId) && explicitPlayerId > 0) {
    const match = components.findIndex(
      (component, index) =>
        index !== jumpIndex &&
        component.type === "video" &&
        Number(component.legacyComponentId) === explicitPlayerId,
    );
    return match === -1 ? null : match;
  }

  const explicitVimeoId = normalizeVimeoId(jump.vimeoId);
  if (explicitVimeoId) {
    const matches = components
      .map((component, index) =>
        index !== jumpIndex &&
        component.type === "video" &&
        normalizeVimeoId(component.vimeoId) === explicitVimeoId
          ? index
          : -1,
      )
      .filter((index) => index >= 0);
    return matches.length === 1 ? matches[0]! : null;
  }

  for (let index = jumpIndex - 1; index >= 0; index -= 1) {
    const candidate = components[index];
    if (candidate?.type === "video" && normalizeVimeoId(candidate.vimeoId)) return index;
  }
  return null;
}

export type UnattachedJumpLinksReason = "no-links" | "no-matching-video" | "no-links-no-video";

/**
 * A jump-links component stays on its own when it has no chapters, or when
 * it cannot be tied to one video. An owned component with chapters returns null.
 */
export function unattachedJumpLinksReason(
  components: JumpLinkAssociable[],
  jumpIndex: number,
): UnattachedJumpLinksReason | null {
  const jump = components[jumpIndex];
  if (!jump || !isVimeoJumpLinksComponent(jump)) return null;
  const owner = videoIndexOwningJumpLinks(components, jumpIndex);
  const hasLinks = jumpsFromComponent(jump).length > 0;
  if (owner != null && hasLinks) return null;
  if (!hasLinks && owner == null) return "no-links-no-video";
  if (!hasLinks) return "no-links";
  return "no-matching-video";
}

export function unattachedJumpLinksSummary(reason: UnattachedJumpLinksReason): string {
  if (reason === "no-links") return "No links";
  if (reason === "no-links-no-video") return "No links and no matching video";
  return "No matching video";
}

export function jumpLinksOwnedByVideo<T extends JumpLinkAssociable>(
  components: T[],
  videoIndex: number,
): T[] {
  if (components[videoIndex]?.type !== "video") return [];
  return components.filter(
    (_, index) =>
      videoIndexOwningJumpLinks(components, index) === videoIndex &&
      unattachedJumpLinksReason(components, index) == null,
  );
}

export function videoJumpLinksOutlineSummary(
  video: { vimeoId?: unknown },
  jumpLinkComponents: unknown[],
): string | null {
  if (jumpLinkComponents.length === 0) return null;
  const count = jumpLinkComponents.reduce<number>(
    (total, component) => total + jumpsFromComponent(component).length,
    0,
  );
  const label = `${count} jump link${count === 1 ? "" : "s"}`;
  const vimeoId = normalizeVimeoId(video.vimeoId);
  return vimeoId ? `${vimeoId} · ${label}` : label;
}

function videoUnit<T extends JumpLinkAssociable>(
  components: T[],
  videoLegacyComponentId: number,
): { ordered: T[]; videoIndex: number; owned: T[] } | null {
  const ordered = componentsInPreviewOrder(components);
  const videoIndex = ordered.findIndex(
    (component) =>
      component.type === "video" &&
      Number(component.legacyComponentId) === Number(videoLegacyComponentId),
  );
  if (videoIndex === -1) return null;
  const owned = jumpLinksOwnedByVideo(ordered, videoIndex);
  if (owned.length === 0) return null;
  return { ordered, videoIndex, owned };
}

function stampComponentOrder<T extends JumpLinkAssociable>(components: T[]): T[] {
  components.forEach((component, index) => {
    component.order = index + 1;
  });
  return components;
}

/** Move a video and the jump links that belong to it, keeping the links immediately after the video. */
export function listAfterMovingVideoWithJumpLinks<T extends JumpLinkAssociable>(
  components: T[],
  videoLegacyComponentId: number,
  targetLegacyComponentId: number,
  targetType: string,
  moveDown: boolean,
): T[] | null {
  const unit = videoUnit(components, videoLegacyComponentId);
  if (!unit) return null;
  const video = unit.ordered[unit.videoIndex]!;
  const ownedIds = new Set(unit.owned.map((component) => component));
  const rest = unit.ordered.filter((component) => component !== video && !ownedIds.has(component));
  const targetIndex = rest.findIndex(
    (component) =>
      Number(component.legacyComponentId) === Number(targetLegacyComponentId) &&
      String(component.type ?? "") === targetType,
  );
  if (targetIndex === -1) return null;
  const insertAt = moveDown ? targetIndex + 1 : targetIndex;
  rest.splice(insertAt, 0, video, ...unit.owned);
  return stampComponentOrder(rest);
}

export function listsAfterMovingVideoWithJumpLinksAcross<T extends JumpLinkAssociable>(
  source: T[],
  destination: T[],
  videoLegacyComponentId: number,
  targetLegacyComponentId: number,
  targetType: string,
  moveDown: boolean,
): { source: T[]; destination: T[] } | null {
  const unit = videoUnit(source, videoLegacyComponentId);
  if (!unit) return null;
  const video = unit.ordered[unit.videoIndex]!;
  const ownedIds = new Set(unit.owned.map((component) => component));
  const sourceRest = unit.ordered.filter(
    (component) => component !== video && !ownedIds.has(component),
  );
  const destinationOrdered = componentsInPreviewOrder(destination);
  const targetIndex = destinationOrdered.findIndex(
    (component) =>
      Number(component.legacyComponentId) === Number(targetLegacyComponentId) &&
      String(component.type ?? "") === targetType,
  );
  if (targetIndex === -1) return null;
  const insertAt = moveDown ? targetIndex + 1 : targetIndex;
  destinationOrdered.splice(insertAt, 0, video, ...unit.owned);
  return {
    source: stampComponentOrder(sourceRest),
    destination: stampComponentOrder(destinationOrdered),
  };
}

export function listAfterDuplicatingVideoWithJumpLinks<T extends JumpLinkAssociable>(
  components: T[],
  videoLegacyComponentId: number,
  allocateId: () => number,
): { components: T[]; cloneLegacyComponentId: number } | null {
  const unit = videoUnit(components, videoLegacyComponentId);
  if (!unit) return null;
  const video = unit.ordered[unit.videoIndex]!;
  const cloneVideo = JSON.parse(JSON.stringify(video)) as T;
  const cloneVideoId = allocateId();
  cloneVideo.legacyComponentId = cloneVideoId;
  const cloneJumps = unit.owned.map((jump) => {
    const clone = JSON.parse(JSON.stringify(jump)) as T;
    clone.legacyComponentId = allocateId();
    if (clone.playerComponentId != null && Number(clone.playerComponentId) > 0) {
      clone.playerComponentId = cloneVideoId;
    }
    if (normalizeVimeoId(clone.vimeoId)) {
      clone.vimeoId = normalizeVimeoId(cloneVideo.vimeoId);
    }
    return clone;
  });
  const lastOwned = unit.owned[unit.owned.length - 1]!;
  const insertAfter = unit.ordered.indexOf(lastOwned);
  const next = [...unit.ordered];
  next.splice(insertAfter + 1, 0, cloneVideo, ...cloneJumps);
  return {
    components: stampComponentOrder(next),
    cloneLegacyComponentId: cloneVideoId,
  };
}

export function listAfterDeletingVideoWithJumpLinks<T extends JumpLinkAssociable>(
  components: T[],
  videoLegacyComponentId: number,
): T[] | null {
  const unit = videoUnit(components, videoLegacyComponentId);
  if (!unit) return null;
  const video = unit.ordered[unit.videoIndex]!;
  const ownedIds = new Set(unit.owned.map((component) => component));
  return stampComponentOrder(
    unit.ordered.filter((component) => component !== video && !ownedIds.has(component)),
  );
}

export function siblingVimeoFromComponents(
  components: Array<{ type?: unknown; vimeoId?: unknown; legacyComponentId?: unknown; order?: unknown; legacySlot?: unknown; legacyType?: unknown; playerComponentId?: unknown }>,
  currentLegacyComponentId?: number,
): { vimeoId: string; playerComponentId: number | null } {
  const ordered = componentsInPreviewOrder(components);
  const jumpIndex = ordered.findIndex(
    (component) =>
      isVimeoJumpLinksComponent(component) &&
      Number(component.legacyComponentId) === Number(currentLegacyComponentId),
  );
  if (jumpIndex === -1) return { vimeoId: "", playerComponentId: null };
  const ownerIndex = videoIndexOwningJumpLinks(ordered, jumpIndex);
  if (ownerIndex == null) return { vimeoId: "", playerComponentId: null };
  const video = ordered[ownerIndex]!;
  return {
    vimeoId: normalizeVimeoId(video.vimeoId),
    playerComponentId: Number(video.legacyComponentId) || null,
  };
}

export function toNativeVimeoJumpLinksComponent(
  component: Record<string, unknown>,
  patch: {
    jumps?: VimeoJump[];
    vimeoId?: string | null;
    playerComponentId?: number | null;
  } = {},
): NativeVimeoJumpLinksComponent {
  const jumps = patch.jumps ?? jumpsFromComponent(component);
  const vimeoId =
    patch.vimeoId !== undefined
      ? normalizeVimeoId(patch.vimeoId)
      : normalizeVimeoId(component.vimeoId);
  const playerComponentId =
    patch.playerComponentId !== undefined
      ? patch.playerComponentId
      : Number(component.playerComponentId) || null;
  const legacyFields = isRecord(component.legacyFields)
    ? syncJumpLegacyFields(component.legacyFields as Record<string, string>, jumps)
    : syncJumpLegacyFields(undefined, jumps);

  const native: NativeVimeoJumpLinksComponent = {
    type: "vimeoJumpLinks",
    vimeoId: vimeoId || null,
    playerComponentId: playerComponentId && playerComponentId > 0 ? playerComponentId : null,
    jumps,
    legacyComponentId: Number(component.legacyComponentId) || 0,
    order: Number(component.order) || 0,
    legacyFields,
  };

  if (Array.isArray(component.notes)) native.notes = component.notes as string[];
  return native;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function vimeoJumpLinksSummary(component: Record<string, unknown>): string {
  const jumps = jumpsFromComponent(component);
  const count = jumps.length;
  return `${count} chapter${count === 1 ? "" : "s"}`;
}

export type { CourseComponent };
