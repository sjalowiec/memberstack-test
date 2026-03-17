/**
 * Dev-only gating bypass: set by BaseLayout when PUBLIC_DEV_BYPASS_GATING=true in dev.
 * Inline scripts check this to show gated content without Memberstack login.
 */
declare global {
  interface Window {
    __DEV_BYPASS_GATING?: boolean;
  }
}

export {};
