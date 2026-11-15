import { normalizeAccountRecord } from "./account.js";
import {
  makeStoragePayload,
  readStoragePayload,
} from "./schedule.js";

export const WEB_STORAGE_KEY = "daily-route.storage.v1";
export const NATIVE_STORAGE_KEY = "daily-route.storage.v2";
export const NATIVE_STORAGE_VERSION = 2;

export function readWebEvents(storage = localStorage) {
  const stored = storage.getItem(WEB_STORAGE_KEY);
  if (!stored) {
    return [];
  }

  const payload = JSON.parse(stored);
  return Array.isArray(payload)
    ? readStoragePayload({ events: payload })
    : readStoragePayload(payload);
}

export function writeWebEvents(events, storage = localStorage) {
  storage.setItem(
    WEB_STORAGE_KEY,
    JSON.stringify(makeStoragePayload(events)),
  );
}

export function normalizeNativeState(payload) {
  if (
    !payload ||
    payload.version !== NATIVE_STORAGE_VERSION ||
    !Array.isArray(payload.events)
  ) {
    return null;
  }

  const account = normalizeAccountRecord(payload.account);
  if (!account) {
    return null;
  }

  return {
    version: NATIVE_STORAGE_VERSION,
    account,
    sessionActive: payload.sessionActive === true,
    events: readStoragePayload(payload),
  };
}

export function makeNativeStatePayload({
  account,
  sessionActive,
  events,
}) {
  return {
    version: NATIVE_STORAGE_VERSION,
    account,
    sessionActive: sessionActive === true,
    events,
  };
}

export function readNativeState(storage = localStorage) {
  const stored = storage.getItem(NATIVE_STORAGE_KEY);
  if (!stored) {
    return { status: "empty", state: null };
  }

  try {
    const state = normalizeNativeState(JSON.parse(stored));
    return state
      ? { status: "ok", state }
      : { status: "corrupt", state: null };
  } catch {
    return { status: "corrupt", state: null };
  }
}

export function writeNativeState(state, storage = localStorage) {
  storage.setItem(
    NATIVE_STORAGE_KEY,
    JSON.stringify(makeNativeStatePayload(state)),
  );
}

export function removeNativeState(storage = localStorage) {
  storage.removeItem(NATIVE_STORAGE_KEY);
}
