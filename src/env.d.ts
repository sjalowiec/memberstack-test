/// <reference types="astro/client" />

/**
 * Dev-only gating bypass: set by BaseLayout when PUBLIC_DEV_BYPASS_GATING=true in dev.
 * Inline scripts check this to show gated content without Memberstack login.
 */
interface ImportMetaEnv {
  /** Server-only: Memberstack Admin API key for token verification (My Library APIs). */
  readonly MEMBERSTACK_SECRET_KEY?: string;
}

declare global {
  interface Window {
    /** Pinterest pinit.js */
    PinUtils?: { build?: () => void; parse?: () => void };
    /** Safe PinUtils.build/parse; alias: kbmPinterestBuild */
    kbmInitPinterestEmbeds?: () => void;
    kbmPinterestBuild?: () => void;
    /** rAF + short retry until PinUtils exists (tab-hidden embeds) */
    kbmSchedulePinterestEmbedsRefresh?: () => void;
    __DEV_BYPASS_GATING?: boolean;
    /** Localhost + ?member=true: set in BaseLayout for client-side gates (videos, etc.). */
    __KBM_DEV_MEMBER__?: boolean;
    /** Memberstack DOM API (injected by app script). */
    $memberstackDom?: {
      getAppAndMember?: () => Promise<unknown>;
      getCurrentMember?: () => Promise<unknown>;
      /** JWT for Authorization header when calling site APIs (if available). */
      getMemberCookie?: () => string | null | Promise<string | null>;
    };
  }
}

declare namespace App {
  interface Locals {
    msToken?: string | null;
  }
}

export {};
