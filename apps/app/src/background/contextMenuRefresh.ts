type RefreshTask = () => Promise<void>;

export function createRefreshScheduler(
  refresh: RefreshTask,
  onError: (error: unknown) => void,
) {
  let refreshRequested = false;
  let refreshPromise: Promise<void> | undefined;

  function requestRefresh() {
    refreshRequested = true;

    if (refreshPromise) return;

    refreshPromise = (async () => {
      while (refreshRequested) {
        refreshRequested = false;

        try {
          await refresh();
        } catch (error) {
          onError(error);
        }
      }
    })().finally(() => {
      refreshPromise = undefined;

      // A request can arrive after the loop finishes but before the promise's
      // cleanup runs. Make sure that request is not lost.
      if (refreshRequested) requestRefresh();
    });
  }

  return requestRefresh;
}

