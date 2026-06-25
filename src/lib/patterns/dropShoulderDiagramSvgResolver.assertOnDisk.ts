/**
 * Node-only disk checks for drop-shoulder diagram SVG inventory (Vitest / CI only).
 * Keep separate from `dropShoulderDiagramSvgResolver.ts` so the browser bundle never imports `node:fs`.
 */
import { existsSync } from "node:fs";
import { resolve as pathResolve } from "node:path";
import { DROP_SHOULDER_DIAGRAM_ASSETS } from "./dropShoulderDiagramSvgResolver";

/** Verifies registry paths exist under `public/`. */
export function assertDropShoulderDiagramAssetsExistOnDisk(publicRoot = "public"): void {
  for (const asset of DROP_SHOULDER_DIAGRAM_ASSETS) {
    const diskPath = pathResolve(publicRoot + asset.src);
    if (!existsSync(diskPath)) {
      throw new Error(`Missing drop-shoulder diagram asset on disk: ${diskPath}`);
    }
  }
}
