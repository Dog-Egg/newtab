import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { platform } from "@platform";
import type {
  CustomEngineDraft,
  StoredSearchEngineSettings,
  UrlSearchEngine,
} from "./schema";
import {
  getAvailableSearchEngines,
  PRESET_SEARCH_ENGINES,
} from "./search-engine-utils";

export function useSearchEngineSettings() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<StoredSearchEngineSettings>({});
  const current = useRef(settings);
  const [isLoaded, setLoaded] = useState(false);
  const [isSaving, setSaving] = useState(false);

  const reportLoadFailure = useEffectEvent((error: unknown) => {
    console.error("Failed to load search engine settings", error);
    toast.error(t("search.loadFailed"));
  });

  useEffect(() => {
    let active = true;
    void platform.searchEngineSettings
      .read()
      .then((value) => {
        if (active) {
          current.current = value;
          setSettings(value);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          reportLoadFailure(error);
        }
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const engines = useMemo(
    () =>
      getAvailableSearchEngines(settings, !!platform.search.browserSearch).map(
        (engine) =>
          engine.kind === "browser"
            ? { ...engine, name: t("search.browserDefaultName") }
            : engine,
      ),
    [settings, t],
  );
  const selectedId =
    settings.selectedEngineId ?? platform.search.defaultEngineId;
  const selectedEngine =
    engines.find((engine) => engine.id === selectedId) ?? engines[0];

  async function update(next: StoredSearchEngineSettings): Promise<boolean> {
    current.current = next;
    setSettings(next);
    setSaving(true);
    try {
      await platform.searchEngineSettings.save(next);
      return true;
    } catch (error) {
      console.error("Failed to save search engine settings", error);
      toast.error(t("search.saveFailed"));
      return false;
    } finally {
      setSaving(false);
    }
  }

  function select(engineId: string) {
    return update({ ...current.current, selectedEngineId: engineId });
  }

  function save(draft: CustomEngineDraft, engineId: string) {
    const previous = current.current;
    const customEngines = previous.customEngines ?? [];
    const entry = { id: engineId, ...draft };
    return update({
      ...previous,
      hiddenDefaultEngineIds: previous.hiddenDefaultEngineIds?.filter(
        (id) => id !== engineId,
      ),
      customEngines: customEngines.some((engine) => engine.id === engineId)
        ? customEngines.map((engine) =>
            engine.id === engineId ? entry : engine,
          )
        : [...customEngines, entry],
    });
  }

  function add(draft: CustomEngineDraft, engineId: string) {
    const previous = current.current;
    return update({
      ...previous,
      selectedEngineId: engineId,
      customEngines: [
        ...(previous.customEngines ?? []).filter(
          (engine) => engine.id !== engineId,
        ),
        { id: engineId, ...draft },
      ],
    });
  }

  function remove(engine: UrlSearchEngine) {
    const fallback = engines.find((candidate) => candidate.id !== engine.id);
    if (!fallback) return Promise.resolve(false);
    const previous = current.current;
    const isPreset = PRESET_SEARCH_ENGINES.some(
      (preset) => preset.id === engine.id,
    );
    return update({
      ...previous,
      selectedEngineId:
        selectedEngine.id === engine.id
          ? fallback.id
          : previous.selectedEngineId,
      hiddenDefaultEngineIds: isPreset
        ? [...new Set([...(previous.hiddenDefaultEngineIds ?? []), engine.id])]
        : previous.hiddenDefaultEngineIds,
      customEngines: previous.customEngines?.filter(
        (entry) => entry.id !== engine.id,
      ),
    });
  }

  return {
    engines,
    selectedEngine,
    isLoaded,
    isSaving,
    select,
    save,
    add,
    remove,
  };
}
