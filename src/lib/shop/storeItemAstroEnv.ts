import {
  combineStoreItemSiteEnv,
  type StoreItemSiteEnv,
} from "./storeItemPersist";

/**
 * Astro inlines literal `import.meta.env.*` at build time. Fill any Netlify
 * site values the function runtime did not provide. A preview context from
 * either source still blocks writes.
 */
export function storeItemAstroEnv(): StoreItemSiteEnv {
  return combineStoreItemSiteEnv(
    {
      CONTEXT: process.env.CONTEXT,
      SITE_ID: process.env.SITE_ID,
      SITE_NAME: process.env.SITE_NAME,
      URL: process.env.URL,
      DEPLOY_PRIME_URL: process.env.DEPLOY_PRIME_URL,
    },
    {
      CONTEXT: import.meta.env.CONTEXT,
      SITE_ID: import.meta.env.SITE_ID,
      SITE_NAME: import.meta.env.SITE_NAME,
      URL: import.meta.env.URL,
      DEPLOY_PRIME_URL: import.meta.env.DEPLOY_PRIME_URL,
    },
  );
}

export const storeItemAstroDev = {
  isViteDev: import.meta.env.DEV,
};
