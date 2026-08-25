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
  /** Server-only: live Memberstack Admin API secret (production). */
  readonly MEMBERSTACK_SECRET_KEY?: string;
  /**
   * Server-only: sandbox/test Memberstack Admin API secret for local/dev.
   * Preferred outside production so Admin matches browser TEST mode.
   */
  readonly MEMBERSTACK_SANDBOX_SECRET_KEY?: string;
  /**
   * Server-only: Stripe secret (restricted, read-only) key used by the Watson
   * Sales Report to retrieve actual collected membership payments. NEVER expose
   * to the browser.
   */
  readonly STRIPE_SECRET_KEY?: string;
  /**
   * Server-only: Stripe webhook endpoint secret (`whsec_...`) used to verify
   * `Stripe-Signature` on paid-download Checkout Session events. NEVER expose
   * to the browser.
   */
  readonly STRIPE_WEBHOOK_SECRET?: string;
  /** Server-only: optional Stripe API base override (tests/mocks). */
  readonly STRIPE_API_BASE?: string;
  /** Server-only: comma/space-separated Stripe price ids billed as MONTHLY membership. */
  readonly STRIPE_MEMBERSHIP_MONTHLY_PRICE_IDS?: string;
  /** Server-only: comma/space-separated Stripe price ids billed as ANNUAL membership. */
  readonly STRIPE_MEMBERSHIP_ANNUAL_PRICE_IDS?: string;
  /** Server-only: additional (legacy) membership Stripe price ids classified as "other". */
  readonly STRIPE_MEMBERSHIP_OTHER_PRICE_IDS?: string;
  /** Server-only: Stripe product ids that are Knit It Now membership products. */
  readonly STRIPE_MEMBERSHIP_PRODUCT_IDS?: string;
  /**
   * Server-only, LOCAL DEV ONLY: when "1"/"true"/"yes" outside production, the
   * Stripe reporting client relaxes TLS verification (client-scoped https.Agent)
   * to work around local SSL inspection / incomplete cert chains. Ignored in
   * production. Prefer NODE_EXTRA_CA_CERTS for a proper fix.
   */
  readonly STRIPE_TLS_INSECURE?: string;
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
    /** Latest member-access resolution from BaseLayout (for late-loading page gates). */
    __KIN_MEMBER_ACCESS__?: {
      hasMemberAccess: boolean;
      viewerAccessState: "loggedOut" | "loggedInNoAccess" | "memberAccess";
    } | null;
    /** Global member gate: true when logged in with an active allowed plan (beta/membership/legacy). */
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
    /**
     * Memberstack Webflow/CDN cookie config. Must be set before the install
     * script so login is stored on `.knititnow.com` instead of localStorage.
     */
    memberstackConfig?: {
      useCookies?: boolean;
      setCookieOnRootDomain?: boolean;
    };
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
      init?: (config?: {
        useCookies?: boolean;
        setCookieOnRootDomain?: boolean;
      }) => void;
      onReady?: Promise<unknown>;
    };
    /** Opens Memberstack login modal with an explicit return path (dynamic CTAs). */
    kbmOpenMemberstackLoginModal?: (returnPath?: string) => void;
    /** Opens the clean public signup modal (custom signup form, not the prebuilt MS modal). */
    kbmOpenPublicSignupModal?: () => void;
    /**
     * Hat/Blanket builder membership gate: resolves true when the visitor has active
     * Knit it Now membership (may generate a pattern), otherwise opens the membership
     * prompt and resolves false. Installed by the PatternBuilderAccountGate modal.
     */
    kbmEnsurePatternBuilderAccountGate?: () => Promise<boolean>;
    /** Opens the Hat/Blanket membership gate prompt. */
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
