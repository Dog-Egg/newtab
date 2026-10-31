import * as z from "zod/mini";

export const SEARCH_ENGINE_SETTINGS_KEY = "search-engine-settings";
export const BROWSER_DEFAULT_ENGINE_ID = "_default_";

const optionalStringArraySchema = z.optional(
  z.pipe(
    z.array(z.catch(z.optional(z.string()), undefined)),
    z.transform((values) =>
      values.flatMap((value) => (value === undefined ? [] : [value])),
    ),
  ),
);

const trimmedNonEmptyStringSchema = z.string().check(z.trim(), z.minLength(1));

export const customEngineDraftSchema = z.object({
  name: trimmedNonEmptyStringSchema,
  urlFormat: z.pipe(
    trimmedNonEmptyStringSchema,
    z.url({ protocol: /^https?$/ }),
  ),
});

// Keep legacy URL strings editable; validate HTTP(S) when saving or searching.
const storedEngineSchema = z.object({
  id: z.string().check(
    z.minLength(1),
    z.refine((id) => id !== BROWSER_DEFAULT_ENGINE_ID),
  ),
  name: trimmedNonEmptyStringSchema,
  urlFormat: trimmedNonEmptyStringSchema,
});

export const customEngineSchema = z.object({
  ...storedEngineSchema.shape,
  ...customEngineDraftSchema.shape,
});

export const searchEngineSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("browser"),
    id: z.literal(BROWSER_DEFAULT_ENGINE_ID),
    name: trimmedNonEmptyStringSchema,
  }),
  z.object({ kind: z.literal("url"), ...storedEngineSchema.shape }),
]);

export type CustomEngineDraft = z.infer<typeof customEngineDraftSchema>;
export type SearchEngine = z.infer<typeof searchEngineSchema>;

const optionalCustomEnginesSchema = z.optional(
  z.pipe(
    z.array(z.catch(z.optional(storedEngineSchema), undefined)),
    z.transform((engines) =>
      engines.flatMap((engine) => (engine === undefined ? [] : [engine])),
    ),
  ),
);

export const searchEngineSettingsSchema = z.pipe(
  z.transform((value) =>
    value && typeof value === "object" && !Array.isArray(value) ? value : {},
  ),
  z.object({
    selectedEngineId: z.catch(z.optional(z.string()), undefined),
    hiddenDefaultEngineIds: z.catch(optionalStringArraySchema, undefined),
    customEngines: z.catch(optionalCustomEnginesSchema, undefined),
  }),
);

export type StoredSearchEngineSettings = z.infer<
  typeof searchEngineSettingsSchema
>;

export type UrlSearchEngine = Extract<SearchEngine, { kind: "url" }>;
