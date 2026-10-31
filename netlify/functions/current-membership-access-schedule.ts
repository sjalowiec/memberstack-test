/**
 * Daily starter. Scheduled functions cannot be called by URL and are limited
 * to a short run, so this only starts the background reconciliation.
 */
export default async (): Promise<Response> => {
  const base = (process.env.URL || "https://knititnow.com").replace(/\/$/, "");
  const nextRun = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const response = await fetch(
    `${base}/.netlify/functions/current-membership-access-sync-background`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ next_run: nextRun }),
    },
  );
  console.log("[current-membership-access-schedule]", response.status);
  return new Response(null, { status: 202 });
};
