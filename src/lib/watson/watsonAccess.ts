export function isWatsonRoute(pathname: string): boolean {
  return pathname === "/watson" || pathname.startsWith("/watson/");
}

export function watsonAccessDeniedMessage(status: number, error?: string): string {
  if (status === 401) {
    return error || "Sign in with an admin account to use Watson.";
  }
  if (status === 403) {
    return error || "You don't have admin access to Watson.";
  }
  return error || "Watson is unavailable right now.";
}

export function watsonAccessDeniedHtml(status: number, error?: string): string {
  const message = watsonAccessDeniedMessage(status, error);
  const title = status === 401 ? "Sign in required" : status === 403 ? "Admin access required" : "Watson unavailable";

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title} | Watson</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 2rem; color: #243015; }
      main { max-width: 36rem; }
      h1 { font-size: 1.5rem; margin: 0 0 0.75rem; }
      p { line-height: 1.5; color: #475569; }
      a { color: #3f6212; font-weight: 600; }
    </style>
  </head>
  <body>
    <main>
      <h1>Watson</h1>
      <p>${escapeHtml(message)}</p>
      <p><a href="/account">Go to account sign-in</a></p>
    </main>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function watsonAccessDeniedResponse(status: number, error?: string): Response {
  return new Response(watsonAccessDeniedHtml(status, error), {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
