/**
 * Hyvor Talk Authentication Loader
 * 
 * Ensures Hyvor Talk comments only load after workshop authentication exists,
 * so paid users never see a Hyvor login prompt.
 * 
 * DEV TEST INSTRUCTIONS:
 * To simulate a paid user during development, open DevTools and run:
 * 
 * localStorage.setItem("kbm_user", JSON.stringify({
 *   id: "dev-1",
 *   name: "Betty",
 *   email: "betty@example.com"
 * }));
 * location.reload();
 */

export async function waitForAuth({ timeoutMs = 8000, intervalMs = 150 } = {}) {
  const start = Date.now();

  const getUser = () => {
    // Future: replace with Memberstack / Outseta user
    if (window.KBM_AUTH?.user) return window.KBM_AUTH.user;

    // Dev fallback
    try {
      const raw = localStorage.getItem("kbm_user");
      if (raw) return JSON.parse(raw);
    } catch (e) {}

    return null;
  };

  return new Promise((resolve) => {
    const tick = () => {
      const user = getUser();
      if (user) return resolve({ ok: true, user });
      if (Date.now() - start > timeoutMs) return resolve({ ok: false, user: null });
      setTimeout(tick, intervalMs);
    };
    tick();
  });
}

export function setHyvorIdentity({ websiteId, user }) {
  window.hyvorTalk = window.hyvorTalk || {};
  window.hyvorTalk.website = websiteId;

  window.hyvorTalk.sso = {
    user: {
      id: String(user.id || user.userId || user.email || "unknown"),
      name: String(user.name || user.firstName || "Member"),
      email: String(user.email || ""),
      avatar: user.avatar || ""
    }
  };
}

export function loadHyvorScript() {
  if (document.querySelector('script[data-kbm-hyvor="1"]')) return;

  const s = document.createElement("script");
  s.async = true;
  s.src = "https://talk.hyvor.com/embed/embed.js";
  s.dataset.kbmHyvor = "1";
  document.body.appendChild(s);
}
