/// <reference types="astro/client" />

/**
 * Dev-only gating bypass: set by BaseLayout when PUBLIC_DEV_BYPASS_GATING=true in dev.
 * Inline scripts check this to show gated content without Memberstack login.
 */
interface ImportMetaEnv {
  /**
   * Temporary pre-launch: when "true", emit site-wide noindex/nofollow robots meta.
   * Remove or set "false" at launch and redeploy.
   */
  readonly PUBLIC_NOINDEX?: string;
  /** Server-only: Watson owner password for private admin access. */
  readonly WATSON_ADMIN_PASSWORD?: string;
  /** Server-only: Memberstack Admin API key for token verification (My Library APIs). */
  readonly MEMBERSTACK_SECRET_KEY?: string;
  /** Server-only: Resend API key for transactional email. */
  readonly RESEND_API_KEY?: string;
  /** Server-only: verified sender for Resend (defaults to hello@knititnow.com). */
  readonly CONTACT_FROM_EMAIL?: string;
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
    /** Global member gate: true when logged in with an active allowed plan (beta/basic/premium/legacy). */
    kbmHasMemberAccess?: (memberOrPayload: unknown) => boolean;
    /** Global viewer state: "loggedOut" | "loggedInNoAccess" | "memberAccess". */
    kbmGetViewerAccessState?: (
      memberOrPayload: unknown,
    ) => "loggedOut" | "loggedInNoAccess" | "memberAccess";
    /** Temporary: global member-access debug logging from inline scripts. */
    kbmLogMemberAccessDebug?: (
      gate: string,
      memberOrPayload: unknown,
      extra?: Record<string, unknown>,
    ) => void;
    /** @deprecated Alias of kbmHasMemberAccess (kept for older video gates). */
    kbmHasKinVideoAccess?: (memberOrPayload: unknown) => boolean;
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
      /** Update email and/or password for the logged-in member. */
      updateMemberAuth?: (args: {
        email?: string;
        oldPassword?: string;
        newPassword?: string;
      }) => Promise<unknown>;
      /** Auth lifecycle events (`member.login`, `member.logout`, …). */
      on?: (event: string, handler: (...args: unknown[]) => void) => void;
      openModal?: (type: string, opts?: Record<string, unknown>) => Promise<unknown>;
      purchasePlansWithCheckout?: (opts: {
        priceId: string;
        successUrl?: string;
        cancelUrl?: string;
        autoRedirect?: boolean;
      }) => Promise<{ data?: { url?: string } }>;
      launchStripeCustomerPortal?: (opts?: { returnUrl?: string }) => Promise<{ data?: { url?: string } }>;
      hideModal?: () => void;
      init?: () => void;
      onReady?: Promise<unknown>;
    };
    /** Opens Memberstack login modal with an explicit return path (dynamic CTAs). */
    kbmOpenMemberstackLoginModal?: (returnPath?: string) => void;
    /** Opens the clean public signup modal (custom signup form, not the prebuilt MS modal). */
    kbmOpenPublicSignupModal?: () => void;
    /**
     * Hat/Blanket builder account gate: resolves true when the visitor has an account (may
     * generate a pattern), otherwise opens the signup-first prompt and resolves false.
     * Installed by the PatternBuilderAccountGate modal component.
     */
    kbmEnsurePatternBuilderAccountGate?: () => Promise<boolean>;
    /** Opens the Hat/Blanket signup-first account gate prompt. */
    kbmOpenPatternBuilderAccountPrompt?: () => void;
    /** Two-step password reset modal (see AccountPasswordResetModal.astro). */
    kbmOpenAccountPasswordResetModal?: (prefillEmail?: string) => void;
    kbmCloseAccountPasswordResetModal?: () => void;
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
    watsonAuthenticated?: boolean;
  }
}

export {};
