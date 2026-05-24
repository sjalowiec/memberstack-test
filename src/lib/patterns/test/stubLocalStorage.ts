import { vi } from "vitest";

/** In-memory localStorage for unit tests (Node has no localStorage by default). */
export function stubLocalStorage(): void {
  const store: Record<string, string> = {};
  vi.stubGlobal("localStorage", {
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
  });
}
