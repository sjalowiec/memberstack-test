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
    PinUtils?: {
      build?: (root?: Document | Element | null) => void;
      parse?: () => void;
    };
    /** Safe PinUtils.build/parse; alias: kbmPinterestBuild; optional root = subtree only */
    kbmInitPinterestEmbeds?: (root?: Document | Element | null) => void;
    kbmPinterestBuild?: (root?: Document | Element | null) => void;
    /** rAF + short retry until PinUtils exists (tab-hidden embeds); optional root for scoped build */
    kbmSchedulePinterestEmbedsRefresh?: (root?: Document | Element | null) => void;
    __DEV_BYPASS_GATING?: boolean;
    /** Localhost + ?member=true: set in BaseLayout for client-side gates (videos, etc.). */
    __KBM_DEV_MEMBER__?: boolean;
    /** Set in BaseLayout: kin-access custom field video gate (deny unless false / "false"). */
    kbmHasKinVideoAccess?: (rawKinAccess: unknown) => boolean;
    /** Temporary: kin-access debug logging from inline scripts. */
    kbmLogKinVideoAccessDebug?: (
      context: string,
      opts: {
        member: unknown;
        rawKinAccess: unknown;
        finalHasVideoAccess: boolean;
      },
    ) => void;
    /** Memberstack DOM API (injected by app script). */
    $memberstackDom?: {
      getAppAndMember?: () => Promise<unknown>;
      getCurrentMember?: () => Promise<unknown>;
      /** JWT for Authorization header when calling site APIs (if available). */
      getMemberCookie?: () => string | null | Promise<string | null>;
      /** Account-tied free-form member metadata (`{ data }`). Used for the free-pattern claim. */
      getMemberJSON?: () => Promise<unknown>;
      updateMemberJSON?: (args: { json: Record<string, unknown> }) => Promise<unknown>;
      /** Auth lifecycle events (`member.login`, `member.logout`, …). */
      on?: (event: string, handler: (...args: unknown[]) => void) => void;
    };
    /** Inline scripts in `GlossaryTooltip.astro`; pages may call `closeAll` on tab change / rebuild. */
    __kbmGlossaryApi?: {
      closeAll: () => void;
      ensureGlobalListeners?: () => void;
    };
    __kbmGlossaryGlobalsBound?: boolean;
    /** Client hydration for glossary placeholders (glossary index modal, pattern pages). */
    __kbmHydrateGlossaryTooltips?: (root: ParentNode) => void;
    /** Glossary index: open or switch the term modal by slug (cross-links). */
    __kbmOpenGlossaryTermModal?: (slug: string) => void;
    /** Bookshelf "My Library" client store (see components/bookshelf/LibraryStore.astro). */
    KinBookshelf?: {
      storageKey: string;
      getIds: () => string[];
      has: (id: string) => boolean;
      add: (id: string) => boolean;
      remove: (id: string) => boolean;
      toggle: (id: string) => boolean;
      count: () => number;
    };
    /** Snapshot of auth state set by Header.astro on auth refresh. */
    __KBM_AUTH?: {
      loggedIn?: boolean;
      member?: unknown;
      memberId?: string | null;
    };
  }
}

declare namespace App {
  interface Locals {
    msToken?: string | null;
  }
}

export {};
