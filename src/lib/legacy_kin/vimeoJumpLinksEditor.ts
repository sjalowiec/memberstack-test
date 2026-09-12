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

export function siblingVimeoFromComponents(
  components: Array<{ type?: unknown; vimeoId?: unknown; legacyComponentId?: unknown }>,
  currentLegacyComponentId?: number,
): { vimeoId: string; playerComponentId: number | null } {
  const videos = components.filter(
    (component) =>
      component.type === "video" &&
      Number(component.legacyComponentId) !== Number(currentLegacyComponentId),
  );
  const previous = [...videos]
    .reverse()
    .find((component) => Number(component.legacyComponentId) < Number(currentLegacyComponentId));
  const match = previous || videos.find((component) => normalizeVimeoId(component.vimeoId));
  if (!match) return { vimeoId: "", playerComponentId: null };
  return {
    vimeoId: normalizeVimeoId(match.vimeoId),
    playerComponentId: Number(match.legacyComponentId) || null,
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
