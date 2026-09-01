import * as z from "zod/mini";

export const SEARCH_ENGINE_SETTINGS_KEY = "search-engine-settings";

const optionalStringArraySchema = z.optional(
  z.pipe(
    z.array(z.catch(z.optional(z.string()), undefined)),
    z.transform((values) =>
      values.flatMap((value) => (value === undefined ? [] : [value])),
    ),
  ),
);

const nonEmptyStringSchema = z.string().check(z.minLength(1));
const trimmedNonEmptyStringSchema = z.string().check(z.trim(), z.minLength(1));

const customEngineSchema = z.object({
  id: nonEmptyStringSchema,
  name: trimmedNonEmptyStringSchema,
  urlFormat: trimmedNonEmptyStringSchema,
});

const optionalCustomEnginesSchema = z.optional(
  z.pipe(
    z.array(z.catch(z.optional(customEngineSchema), undefined)),
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
