import { defineCollection, z } from "astro:content";

const wizards = defineCollection({
  type: "data",
  schema: z.any(),
});

export const collections = {
  wizards,
};
