import {
  KIN_VIMEO_PLAYER_ATTR,
  kinVimeoPlayerDomId,
} from "../lib/kinCourse/vimeoJumpLinks";

export type VimeoJumpPlayer = {
  setCurrentTime: (seconds: number) => Promise<unknown> | number | void;
  play: () => Promise<unknown> | void;
};

export type VimeoJumpPlayerConstructor = new (iframe: HTMLIFrameElement) => VimeoJumpPlayer;

const VIMEO_PLAYER_JS = "https://player.vimeo.com/api/player.js";

export function loadVimeoPlayerApi(): Promise<VimeoJumpPlayerConstructor> {
  const existing = (window as unknown as { Vimeo?: { Player?: VimeoJumpPlayerConstructor } }).Vimeo
    ?.Player;
  if (existing) return Promise.resolve(existing);
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = VIMEO_PLAYER_JS;
    script.onload = () => {
      const Player = (window as unknown as { Vimeo?: { Player?: VimeoJumpPlayerConstructor } }).Vimeo
        ?.Player;
      if (Player) resolve(Player);
      else reject(new Error("Vimeo Player API did not load"));
    };
    script.onerror = () => reject(new Error("Vimeo Player API failed to load"));
    document.head.appendChild(script);
  });
}

export function findKinVimeoPlayerIframe(
  root: ParentNode,
  playerKey: string,
): HTMLIFrameElement | null {
  if (!playerKey) return null;
  const byId = root.querySelector<HTMLIFrameElement>(`#${kinVimeoPlayerDomId(playerKey)}`);
  if (byId) return byId;
  return root.querySelector<HTMLIFrameElement>(
    `iframe[${KIN_VIMEO_PLAYER_ATTR}="${playerKey}"]`,
  );
}

export async function seekKinVimeoJump(
  root: ParentNode,
  playerKey: string,
  seconds: number,
  loadPlayer: () => Promise<VimeoJumpPlayerConstructor> = loadVimeoPlayerApi,
): Promise<boolean> {
  if (!playerKey || Number.isNaN(seconds)) return false;
  const iframe = findKinVimeoPlayerIframe(root, playerKey);
  if (!iframe) return false;
  const Player = await loadPlayer();
  const player = new Player(iframe);
  await player.setCurrentTime(seconds);
  await player.play();
  return true;
}

export function bindKinCourseVimeoJumpLinks(
  root: ParentNode,
  loadPlayer: () => Promise<VimeoJumpPlayerConstructor> = loadVimeoPlayerApi,
): void {
  root.querySelectorAll<HTMLElement>(".legacy-jumplinks").forEach((nav) => {
    if (nav.dataset.kinJumpBound === "true") return;
    nav.dataset.kinJumpBound = "true";
    const playerKey = nav.getAttribute(KIN_VIMEO_PLAYER_ATTR) || "";

    nav.addEventListener("click", async (event) => {
      const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>(
        ".legacy-jumplink",
      );
      if (!button) return;
      const seconds = Number(button.getAttribute("data-jump-seconds"));
      if (Number.isNaN(seconds)) return;
      try {
        await seekKinVimeoJump(root, playerKey, seconds, loadPlayer);
      } catch (error) {
        console.error("Vimeo jump failed", error);
      }
    });
  });
}
