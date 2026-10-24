/**
 * Sign-in document for a signed-out admin page request.
 *
 * The server gate runs before any admin HTML, and Memberstack keeps the session
 * JWT in localStorage on hosts that are not the Knit it Now root domain. This
 * document is the only page a signed-out visitor receives. It does not include
 * admin content. After it copies a real JWT into `_ms_cookie`, the next request
 * still goes through `requireAdmin` and the admin allowlist.
 *
 * Admin API responses stay JSON in `adminGateResponse` and do not use this page.
 */

import { MEMBERSTACK_LOCAL_STORAGE_KEY } from "../memberstackSessionBridge";

const MEMBERSTACK_APP_ID = "app_cmfh3d1n802vb0wy706205810";
const MEMBERSTACK_CDN = "https://static.memberstack.com/scripts/v2/memberstack.js";

export const ADMIN_SIGN_IN_BUTTON_ID = "admin-sign-in";
export const ADMIN_SIGN_IN_ATTEMPT_KEY = "kinAdminCookieAttempt";

export function adminSignInClientScript(): string {
  const attemptKey = JSON.stringify(ADMIN_SIGN_IN_ATTEMPT_KEY);
  const localKey = JSON.stringify(MEMBERSTACK_LOCAL_STORAGE_KEY);
  const buttonId = JSON.stringify(ADMIN_SIGN_IN_BUTTON_ID);

  return `(function () {
  var ATTEMPT_KEY = ${attemptKey};
  var LOCAL_KEY = ${localKey};
  var BUTTON_ID = ${buttonId};
  var COOKIE_NAMES = {
    "_ms_cookie": true,
    "_ms-mid": true,
    "_ms_mid": true,
    "memberstack": true,
    "memberstack_access_token": true
  };
  var continuing = false;

  function looksLikeJwt(value) {
    var token = String(value || "").trim();
    return token.split(".").length === 3 && token.length > 20;
  }

  function storedJwt() {
    try {
      var local = localStorage.getItem(LOCAL_KEY) || "";
      if (looksLikeJwt(local)) return local.trim();
    } catch (e) {}
    var parts = document.cookie ? String(document.cookie).split(";") : [];
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i];
      var eq = part.indexOf("=");
      if (eq === -1) continue;
      var name = part.slice(0, eq).trim();
      if (!COOKIE_NAMES[name]) continue;
      var value = part.slice(eq + 1).trim();
      if (value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
        value = value.slice(1, -1);
      }
      try { value = decodeURIComponent(value); } catch (e) {}
      if (looksLikeJwt(value)) return value.trim();
    }
    return "";
  }

  function publish(token) {
    var trimmed = String(token || "").trim();
    if (!looksLikeJwt(trimmed)) return;
    var host = String(location.hostname || "").trim().toLowerCase().replace(/\\.$/, "");
    var secure = host !== "localhost" && host !== "127.0.0.1";
    var onKnitItNow = host === "knititnow.com" || host.endsWith(".knititnow.com");
    var domain = onKnitItNow ? "; Domain=.knititnow.com" : "";
    document.cookie = "_ms_cookie=" + encodeURIComponent(trimmed)
      + "; Path=/; Max-Age=1209600; SameSite=Lax"
      + (secure ? "; Secure" : "")
      + domain;
  }

  function remember(token) {
    try { sessionStorage.setItem(ATTEMPT_KEY, token); } catch (e) {}
  }

  function attemptedToken() {
    try { return sessionStorage.getItem(ATTEMPT_KEY) || ""; } catch (e) { return ""; }
  }

  function finish(token, fromLogin) {
    if (continuing) return false;
    var jwt = looksLikeJwt(token) ? String(token).trim() : "";
    if (!jwt) return false;
    if (!fromLogin && attemptedToken() === jwt) return false;
    publish(jwt);
    remember(jwt);
    continuing = true;
    location.reload();
    return true;
  }

  function tokenFromMemberstack() {
    var ms = window.$memberstackDom;
    if (!ms || typeof ms.getMemberCookie !== "function") return Promise.resolve(storedJwt());
    try {
      var value = ms.getMemberCookie();
      if (value && typeof value.then === "function") {
        return value.then(function (token) {
          return looksLikeJwt(token) ? String(token).trim() : storedJwt();
        }, function () { return storedJwt(); });
      }
      if (looksLikeJwt(value)) return Promise.resolve(String(value).trim());
    } catch (e) {}
    return Promise.resolve(storedJwt());
  }

  function onLoginSuccess() {
    var immediate = storedJwt();
    if (immediate) publish(immediate);
    tokenFromMemberstack().then(function (token) {
      finish(looksLikeJwt(token) ? token : immediate, true);
    });
  }

  if (finish(storedJwt(), false)) return;

  function setStatus(message) {
    var el = document.getElementById("admin-sign-in-status");
    if (!el) return;
    el.hidden = !message;
    el.textContent = message || "";
  }

  function openLogin() {
    var ms = window.$memberstackDom;
    if (ms && typeof ms.openModal === "function") {
      setStatus("Opening sign in…");
      ms.openModal("LOGIN").then(onLoginSuccess, function () { setStatus(""); });
      return;
    }
    if (ms && ms.onReady && typeof ms.onReady.then === "function") {
      ms.onReady.then(openLogin, function () {
        setStatus("Sign in is still loading. Try again in a moment.");
      });
      return;
    }
    setStatus("Sign in is still loading. Try again in a moment.");
  }

  var button = document.getElementById(BUTTON_ID);
  if (button) {
    button.addEventListener("click", function (event) {
      event.preventDefault();
      openLogin();
    });
  }

  function bindLoginEvent(attempt) {
    var ms = window.$memberstackDom;
    if (ms && typeof ms.on === "function") {
      ms.on("member.login", onLoginSuccess);
      return;
    }
    if (attempt < 40) window.setTimeout(function () { bindLoginEvent(attempt + 1); }, 250);
  }
  bindLoginEvent(0);

  function watchRestoredSession(attempt) {
    var ms = window.$memberstackDom;
    if (ms && ms.onReady && typeof ms.onReady.then === "function") {
      ms.onReady.then(function () {
        tokenFromMemberstack().then(function (token) { finish(token, false); });
      }, function () {});
      return;
    }
    if (attempt < 40) window.setTimeout(function () { watchRestoredSession(attempt + 1); }, 250);
  }
  watchRestoredSession(0);
})();`;
}

export function adminSignInPageDocument(): string {
  const script = adminSignInClientScript();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>Sign in required</title>
  <style>
    body {
      margin: 0;
      background: #f6f3ee;
      color: #1c2430;
      font-family: Georgia, "Times New Roman", serif;
    }
    main {
      max-width: 28rem;
      margin: 4rem auto;
      padding: 2rem;
      background: #fff;
      border: 1px solid #e4ddd2;
    }
    h1 { font-size: 1.6rem; margin: 0 0 0.75rem; }
    p { line-height: 1.45; }
    button {
      appearance: none;
      border: 0;
      background: #1f4b3a;
      color: #fff;
      font: inherit;
      font-size: 1rem;
      padding: 0.7rem 1.2rem;
      cursor: pointer;
    }
    button:focus-visible { outline: 2px solid #1f4b3a; outline-offset: 3px; }
    #admin-sign-in-status { min-height: 1.2rem; }
  </style>
  <script>
    var memberstackConfig = { useCookies: true, setCookieOnRootDomain: true };
  </script>
  <script data-memberstack-app="${MEMBERSTACK_APP_ID}" data-memberstack-use-cookies src="${MEMBERSTACK_CDN}"></script>
</head>
<body>
  <main>
    <h1>Sign in required.</h1>
    <p>Sign in with your Knit it Now account to continue.</p>
    <p><button type="button" id="${ADMIN_SIGN_IN_BUTTON_ID}">Sign in</button></p>
    <p id="admin-sign-in-status" role="status" hidden></p>
  </main>
  <script>${script}</script>
</body>
</html>`;
}
