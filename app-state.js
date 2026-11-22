import {
  emptyCategories,
  normalizeActivities,
  normalizeCategories,
} from "./activities.js";
import { normalizeAccountRecord } from "./account.js";

export const WEB_STORAGE_KEY = "daily-route.storage.v1";
export const LEGACY_NATIVE_STORAGE_KEY = "daily-route.storage.v2";
export const PREVIOUS_NATIVE_STORAGE_KEY = "daily-route.storage.v3";
export const NATIVE_STORAGE_KEY = "daily-route.storage.v4";
export const NATIVE_STORAGE_VERSION = 4;
export const PREVIOUS_NATIVE_STORAGE_VERSION = 3;
export const LEGACY_NATIVE_STORAGE_VERSION = 2;

function normalizeYear(value) {
  const year = Number(value);
  return Number.isInteger(year) && year >= 1900 && year <= 9999
    ? year
    : new Date().getFullYear();
}

function parseWebPayload(payload) {
  if (Array.isArray(payload)) {
    return {
      events: normalizeActivities(payload),
      categories: emptyCategories(),
      yearMigrationCompletedFor: new Date().getFullYear(),
    };
  }
  if (!payload || typeof payload !== "object") {
    return {
      events: [],
      categories: emptyCategories(),
      yearMigrationCompletedFor: new Date().getFullYear(),
    };
  }
  const rawEvents = Array.isArray(payload.events) ? payload.events : [];
  return {
    events: normalizeActivities(rawEvents),
    categories: normalizeCategories(payload.categories),
    yearMigrationCompletedFor: normalizeYear(
      payload.yearMigrationCompletedFor,
    ),
  };
}

export function readWebState(storage = localStorage) {
  const stored = storage.getItem(WEB_STORAGE_KEY);
  if (!stored) {
    return {
      events: [],
      categories: emptyCategories(),
      yearMigrationCompletedFor: new Date().getFullYear(),
    };
  }
  return parseWebPayload(JSON.parse(stored));
}

export function readWebEvents(storage = localStorage) {
  return readWebState(storage).events;
}

export function writeWebState(state, storage = localStorage) {
  storage.setItem(
    WEB_STORAGE_KEY,
    JSON.stringify({
      version: NATIVE_STORAGE_VERSION,
      events: state.events,
      categories: normalizeCategories(state.categories),
      yearMigrationCompletedFor: normalizeYear(
        state.yearMigrationCompletedFor,
      ),
    }),
  );
}

export function writeWebEvents(events, storage = localStorage) {
  writeWebState(
    {
      events,
      categories: emptyCategories(),
      yearMigrationCompletedFor: new Date().getFullYear(),
    },
    storage,
  );
}

export function normalizeNativeState(payload) {
  if (
    !payload ||
    ![
      NATIVE_STORAGE_VERSION,
      PREVIOUS_NATIVE_STORAGE_VERSION,
      LEGACY_NATIVE_STORAGE_VERSION,
    ].includes(payload.version) ||
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
    events: normalizeActivities(payload.events),
    categories: normalizeCategories(payload.categories),
    yearMigrationCompletedFor: normalizeYear(
      payload.yearMigrationCompletedFor,
    ),
  };
}

export function makeNativeStatePayload({
  account,
  sessionActive,
  events,
  categories,
  yearMigrationCompletedFor,
}) {
  return {
    version: NATIVE_STORAGE_VERSION,
    account,
    sessionActive: sessionActive === true,
    events: normalizeActivities(events),
    categories: normalizeCategories(categories),
    yearMigrationCompletedFor: normalizeYear(yearMigrationCompletedFor),
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

  for (const key of [
    PREVIOUS_NATIVE_STORAGE_KEY,
    LEGACY_NATIVE_STORAGE_KEY,
  ]) {
    const legacy = storage.getItem(key);
    if (!legacy) {
      continue;
    }
    const state = parseNativePayload(legacy);
    return state
      ? { status: "migrate", state, sourceKey: key }
      : { status: "corrupt", state: null };
  }

  return { status: "empty", state: null };
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
  storage.removeItem(PREVIOUS_NATIVE_STORAGE_KEY);
  storage.removeItem(LEGACY_NATIVE_STORAGE_KEY);
}
