import { numberedLegacyFields } from "./legacyFields";
import type { KinCourseComponent } from "./types";

export const KIN_VIMEO_PLAYER_ATTR = "data-kin-vimeo-player";

export type VimeoJump = {
  time: string;
  title?: string;
};

export type VimeoJumpLinksPlayback = KinCourseComponent & {
  type: "vimeoJumpLinks";
  vimeoId?: string;
  playerComponentId?: number | null;
  playerKey: string;
  embedPlayer: boolean;
  jumps: VimeoJump[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function normalizeVimeoId(value: unknown): string {
  return String(value ?? "").trim();
}

export function isVimeoPlayerComponent(component: Pick<KinCourseComponent, "type">): boolean {
  return component.type === "vimeo" || component.type === "video";
}

export function isVimeoJumpLinksType(type: unknown, legacyType?: unknown): boolean {
  if (String(type ?? "").trim() === "vimeoJumpLinks") return true;
  return (
    String(type ?? "").trim() === "migrationPending" &&
    String(legacyType ?? "").trim().toLowerCase() === "vimeojumplinks"
  );
}

export function jumpSeconds(time: string | undefined): number | null {
  const raw = String(time ?? "").trim();
  if (!raw) return null;
  const parts = raw.split(":").map((part) => Number(part));
  if (parts.length === 0 || parts.some((part) => Number.isNaN(part))) return null;
  if (parts.length === 3) return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
  if (parts.length === 2) return parts[0]! * 60 + parts[1]!;
  if (parts.length === 1) return parts[0]!;
  return null;
}

export function normalizeVimeoJump(jump: unknown): VimeoJump | null {
  if (!isRecord(jump)) return null;
  const time = String(jump.time ?? "").trim();
  if (!time || jumpSeconds(time) == null) return null;
  const title = String(jump.title ?? "");
  return title ? { time, title } : { time };
}

export function jumpsFromLegacyFields(
  fields: Record<string, string> | undefined,
): VimeoJump[] {
  const titles = new Map(
    numberedLegacyFields(fields, "LINKTITLE").map((item) => [item.index, item.value]),
  );
  return numberedLegacyFields(fields, "LINKTIME")
    .map((item) => normalizeVimeoJump({ time: item.value, title: titles.get(item.index) }))
    .filter((jump): jump is VimeoJump => jump != null);
}

export function jumpsFromComponent(component: unknown): VimeoJump[] {
  if (!isRecord(component)) return [];
  const native = Array.isArray(component.jumps)
    ? component.jumps.map(normalizeVimeoJump).filter((jump): jump is VimeoJump => jump != null)
    : [];
  if (native.length > 0) return native;
  return jumpsFromLegacyFields(
    isRecord(component.legacyFields)
      ? (component.legacyFields as Record<string, string>)
      : undefined,
  );
}

export function syncJumpLegacyFields(
  fields: Record<string, string> | undefined,
  jumps: VimeoJump[],
): Record<string, string> {
  const next: Record<string, string> = { ...(fields ?? {}) };
  for (const key of Object.keys(next)) {
    if (/^LINK(?:TIME|TITLE)_\d+$/i.test(key)) delete next[key];
  }
  jumps.forEach((jump, index) => {
    const n = index + 1;
    next[`LINKTIME_${n}`] = jump.time;
    next[`LINKTITLE_${n}`] = jump.title ?? "";
  });
  return next;
}

export function kinVimeoPlayerDomId(playerKey: string): string {
  return `kin-vimeo-player-${playerKey}`;
}

export function kinVimeoPlayerKey(component: {
  playerComponentId?: number | null;
  componentId?: number | null;
  vimeoId?: string;
}): string {
  const id = Number(component.playerComponentId || component.componentId);
  if (Number.isFinite(id) && id > 0) return String(id);
  const vimeoId = normalizeVimeoId(component.vimeoId);
  return vimeoId ? `vimeo-${vimeoId}` : "";
}

function matchingVimeoPlayer(
  videos: KinCourseComponent[],
  jump: KinCourseComponent,
): KinCourseComponent | undefined {
  const vimeoId = normalizeVimeoId(jump.vimeoId);
  const playerId = Number(jump.playerComponentId);
  if (Number.isFinite(playerId) && playerId > 0) {
    const byId = videos.find((video) => Number(video.componentId) === playerId);
    if (byId && (!vimeoId || normalizeVimeoId(byId.vimeoId) === vimeoId)) return byId;
  }
  if (!vimeoId) return undefined;
  return videos.find((video) => normalizeVimeoId(video.vimeoId) === vimeoId);
}

/**
 * Associate jump links with a stable player key and drop extra Vimeo
 * components only when they repeat a video already owned by jump links.
 */
export function prepareVimeoJumpLinkPlayback(
  components: KinCourseComponent[],
): KinCourseComponent[] {
  const videos = components.filter(isVimeoPlayerComponent);
  const associated = components.map((component) => {
    if (component.type !== "vimeoJumpLinks") return component;
    const vimeoId = normalizeVimeoId(component.vimeoId);
    const matching = matchingVimeoPlayer(videos, { ...component, vimeoId });
    const playerComponentId = matching
      ? Number(matching.componentId) || component.playerComponentId || null
      : component.playerComponentId || component.componentId || null;
    const prepared: VimeoJumpLinksPlayback = {
      ...component,
      type: "vimeoJumpLinks",
      vimeoId: vimeoId || normalizeVimeoId(matching?.vimeoId) || undefined,
      playerComponentId,
      playerKey: kinVimeoPlayerKey({
        playerComponentId,
        componentId: matching?.componentId || component.componentId,
        vimeoId: vimeoId || matching?.vimeoId,
      }),
      embedPlayer: !matching,
      jumps: jumpsFromComponent(component),
    };
    return prepared;
  });

  const jumpVideoIds = new Set(
    associated
      .filter((component) => component.type === "vimeoJumpLinks")
      .map((component) => normalizeVimeoId(component.vimeoId))
      .filter(Boolean),
  );
  const seenJumpVideos = new Set<string>();

  return associated.filter((component) => {
    if (!isVimeoPlayerComponent(component)) return true;
    const vimeoId = normalizeVimeoId(component.vimeoId);
    if (!vimeoId || !jumpVideoIds.has(vimeoId)) return true;
    if (seenJumpVideos.has(vimeoId)) return false;
    seenJumpVideos.add(vimeoId);
    return true;
  });
}

export function lessonVimeoPlayerComponents(
  components: KinCourseComponent[],
): KinCourseComponent[] {
  return prepareVimeoJumpLinkPlayback(components).filter(
    (component) =>
      isVimeoPlayerComponent(component) ||
      (component.type === "vimeoJumpLinks" && (component as VimeoJumpLinksPlayback).embedPlayer),
  );
}

export function jumpLinkButtonLabel(jump: VimeoJump): string {
  const title = String(jump.title ?? "").trim();
  if (jump.time && title) return `${jump.time} ${title}`;
  return title || jump.time;
}
