import type { ProgressNavItem } from "../components/ProgressNav.astro";

/**
 * Shared step list for the "Getting Started" beginner guide. Keep this in one
 * place so the ProgressNav renders identically across every beginner page.
 */
export const gettingStartedItems: ProgressNavItem[] = [
  { key: "need-machine", label: "Need a Machine?", href: "/reference/machines/choose" },
  { key: "set-up", label: "Set Up My Machine", href: "/machine-checkup" },
  { key: "first-rows", label: "Knit Your First Rows", href: "/knit-your-first-rows" },
  { key: "first-project", label: "First Project", href: "/first-project" },
];
