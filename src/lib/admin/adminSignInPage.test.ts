import vm from "node:vm";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  ADMIN_SIGN_IN_ATTEMPT_KEY,
  ADMIN_SIGN_IN_BUTTON_ID,
  adminSignInClientScript,
  adminSignInPageDocument,
} from "./adminSignInPage";
import { memberstackTokenFromRequest } from "./requireAdminRequest";
import { memberstackSessionCookieAssignment } from "../memberstackSessionBridge";

const here = dirname(fileURLToPath(import.meta.url));
const JWT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJtZW1fc3VlIn0.signature-value";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    getItem(key: string) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem(key: string, value: string) {
      data[key] = String(value);
    },
    removeItem(key: string) {
      delete data[key];
    },
  };
}

function runScript(options: {
  hostname: string;
  localToken?: string | null;
  cookie?: string;
  attempt?: string | null;
  memberstack?: Record<string, unknown>;
}) {
  const writes: string[] = [];
  const reload = vi.fn();
  const listeners: Record<string, Array<(event: { preventDefault(): void }) => void>> = {};
  const button = {
    addEventListener(type: string, listener: (event: { preventDefault(): void }) => void) {
      listeners[type] = listeners[type] || [];
      listeners[type].push(listener);
    },
  };
  const status = { hidden: true, textContent: "" };
  const localStorage = memoryStorage(
    options.localToken ? { "_ms-mid": options.localToken } : {},
  );
  const sessionStorage = memoryStorage(
    options.attempt ? { [ADMIN_SIGN_IN_ATTEMPT_KEY]: options.attempt } : {},
  );
  const window = {
    $memberstackDom: options.memberstack,
    setTimeout: () => 0,
  };
  const document = {
    cookie: options.cookie || "",
    getElementById(id: string) {
      if (id === ADMIN_SIGN_IN_BUTTON_ID) return button;
      if (id === "admin-sign-in-status") return status;
      return null;
    },
  };
  Object.defineProperty(document, "cookie", {
    configurable: true,
    get() {
      return options.cookie || "";
    },
    set(value: string) {
      writes.push(value);
    },
  });
  const location = { hostname: options.hostname, reload };

  vm.runInNewContext(adminSignInClientScript(), {
    window,
    document,
    localStorage,
    sessionStorage,
    location,
    Promise,
    setTimeout: () => 0,
    clearTimeout,
  });

  return { writes, reload, listeners, status, sessionStorage };
}

describe("admin sign-in page", () => {
  it("uses the same Memberstack app as the rest of the site and no admin content", () => {
    const html = adminSignInPageDocument();
    const layout = readFileSync(join(here, "..", "..", "layouts", "BaseLayout.astro"), "utf8");
    expect(html).toContain("Sign in required.");
    expect(html).toContain(`id="${ADMIN_SIGN_IN_BUTTON_ID}"`);
    expect(html).toContain("data-memberstack-app=\"app_cmfh3d1n802vb0wy706205810\"");
    expect(layout).toContain("data-memberstack-app=\"app_cmfh3d1n802vb0wy706205810\"");
    expect(html.indexOf("var memberstackConfig")).toBeLessThan(
      html.indexOf("static.memberstack.com/scripts/v2/memberstack.js"),
    );
    expect(html).toContain("useCookies: true");
    expect(html).not.toContain("Creator Control Panel");
    expect(html).not.toContain("/api/admin");
    expect(html).not.toContain("$memberstackDom?.init");
  });

  it("publishes a stored owner session into the cookie the server gate already reads", () => {
    const result = runScript({
      hostname: "kin-dev.netlify.app",
      localToken: JWT,
    });
    expect(result.writes).toEqual([
      memberstackSessionCookieAssignment(JWT, "kin-dev.netlify.app"),
    ]);
    expect(result.reload).toHaveBeenCalledOnce();
    const request = new Request("https://kin-dev.netlify.app/admin", {
      headers: { cookie: result.writes[0].split(";")[0] },
    });
    expect(memberstackTokenFromRequest(request)).toBe(JWT);
  });

  it("publishes the production cookie on the Knit it Now parent domain", () => {
    const result = runScript({
      hostname: "www.knititnow.com",
      localToken: JWT,
    });
    expect(result.writes[0]).toBe(memberstackSessionCookieAssignment(JWT, "www.knititnow.com"));
    expect(result.writes[0]).toContain("Domain=.knititnow.com");
    expect(result.writes[0]).toContain("Secure");
  });

  it("does not reload again when that same session was already handed to the server", () => {
    const result = runScript({
      hostname: "kin-dev.netlify.app",
      localToken: JWT,
      attempt: JWT,
    });
    expect(result.writes).toEqual([]);
    expect(result.reload).not.toHaveBeenCalled();
    expect(result.listeners.click).toHaveLength(1);
  });

  it("does not treat a member id as a session", () => {
    const result = runScript({
      hostname: "localhost",
      localToken: "mem_cms4tl24v00eb0sqx143i4a9r",
    });
    expect(result.writes).toEqual([]);
    expect(result.reload).not.toHaveBeenCalled();
    expect(memberstackSessionCookieAssignment("mem_cms4tl24v00eb0sqx143i4a9r", "localhost")).toBeNull();
  });

  it("publishes a session Memberstack restores after the page opens", async () => {
    let markReady: () => void = () => {};
    const result = runScript({
      hostname: "kin-dev.netlify.app",
      memberstack: {
        on() {},
        onReady: new Promise<void>((resolve) => {
          markReady = resolve;
        }),
        getMemberCookie: () => JWT,
      },
    });

    expect(result.reload).not.toHaveBeenCalled();
    markReady();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(result.writes[0]).toBe(memberstackSessionCookieAssignment(JWT, "kin-dev.netlify.app"));
    expect(result.reload).toHaveBeenCalledOnce();
  });

  it("publishes the session from an explicit login and reloads once", async () => {
    let loginHandler: (() => void) | undefined;
    const result = runScript({
      hostname: "kin-dev.netlify.app",
      attempt: JWT,
      memberstack: {
        on(event: string, handler: () => void) {
          if (event === "member.login") loginHandler = handler;
        },
        getMemberCookie: () => JWT,
        openModal: () => Promise.resolve(),
      },
    });

    expect(result.reload).not.toHaveBeenCalled();
    const event = { preventDefault: vi.fn() };
    result.listeners.click[0](event);
    expect(event.preventDefault).toHaveBeenCalled();
    await Promise.resolve();
    await Promise.resolve();
    expect(result.writes[0]).toBe(memberstackSessionCookieAssignment(JWT, "kin-dev.netlify.app"));
    expect(result.reload).toHaveBeenCalledOnce();
    expect(typeof loginHandler).toBe("function");
  });
});
