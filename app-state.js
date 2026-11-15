import { normalizeAccountRecord } from "./account.js";
import {
  makeStoragePayload,
  readStoragePayload,
} from "./schedule.js";

export const WEB_STORAGE_KEY = "daily-route.storage.v1";
export const LEGACY_NATIVE_STORAGE_KEY = "daily-route.storage.v2";
export const NATIVE_STORAGE_KEY = "daily-route.storage.v3";
export const NATIVE_STORAGE_VERSION = 3;
export const LEGACY_NATIVE_STORAGE_VERSION = 2;

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
    ![NATIVE_STORAGE_VERSION, LEGACY_NATIVE_STORAGE_VERSION].includes(
      payload.version,
    ) ||
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

function parseNativePayload(stored) {
  try {
    return normalizeNativeState(JSON.parse(stored));
  } catch {
    return null;
  }
}

export function readNativeState(storage = localStorage) {
  const current = storage.getItem(NATIVE_STORAGE_KEY);
  if (current) {
    const state = parseNativePayload(current);
    return state
      ? { status: "ok", state }
      : { status: "corrupt", state: null };
  }

  const legacy = storage.getItem(LEGACY_NATIVE_STORAGE_KEY);
  if (!legacy) {
    return { status: "empty", state: null };
  }

  const state = parseNativePayload(legacy);
  return state
    ? { status: "migrate", state }
    : { status: "corrupt", state: null };
}

export function migrateNativeState(storage = localStorage) {
  const loaded = readNativeState(storage);
  if (loaded.status !== "migrate") {
    return loaded;
  }

  writeNativeState(loaded.state, storage);
  return { status: "ok", state: loaded.state };
}

export function writeNativeState(state, storage = localStorage) {
  storage.setItem(
    NATIVE_STORAGE_KEY,
    JSON.stringify(makeNativeStatePayload(state)),
  );
}

export function removeNativeState(storage = localStorage) {
  storage.removeItem(NATIVE_STORAGE_KEY);
  storage.removeItem(LEGACY_NATIVE_STORAGE_KEY);
}
