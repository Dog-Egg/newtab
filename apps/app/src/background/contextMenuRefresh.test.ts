import { describe, expect, it, vi } from "vitest";
import { createRefreshScheduler } from "./contextMenuRefresh";

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("createRefreshScheduler", () => {
  it("serializes overlapping refresh requests and coalesces pending work", async () => {
    const firstRefresh = createDeferred();
    const secondRefresh = createDeferred();
    const refresh = vi
      .fn<() => Promise<void>>()
      .mockReturnValueOnce(firstRefresh.promise)
      .mockReturnValueOnce(secondRefresh.promise);
    const requestRefresh = createRefreshScheduler(refresh, vi.fn());

    requestRefresh();
    requestRefresh();
    requestRefresh();

    expect(refresh).toHaveBeenCalledTimes(1);

    firstRefresh.resolve();
    await flushPromises();

    expect(refresh).toHaveBeenCalledTimes(2);

    secondRefresh.resolve();
    await flushPromises();

    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("continues with a queued refresh after an error", async () => {
    const error = new Error("refresh failed");
    const secondRefresh = createDeferred();
    const onError = vi.fn();
    const refresh = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(error)
      .mockReturnValueOnce(secondRefresh.promise);
    const requestRefresh = createRefreshScheduler(refresh, onError);

    requestRefresh();
    requestRefresh();
    await flushPromises();

    expect(onError).toHaveBeenCalledWith(error);
    expect(refresh).toHaveBeenCalledTimes(2);

    secondRefresh.resolve();
    await flushPromises();
  });
});

