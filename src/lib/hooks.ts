"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** Read a browser-only value (feature detection) without a hydration mismatch. */
export function useClientValue<T>(get: () => T, onServer: T): T {
  return useSyncExternalStore(noop, get, () => onServer);
}
