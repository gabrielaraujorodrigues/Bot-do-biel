import path from "path";
import { createScheduledJsonStore } from "./json-store.js";

const FILE = path.join(process.cwd(), "database", "runtime", "profile-rate-limit.json");

function buildDefaultState() {
  return {
    operations: {},
  };
}

const store = createScheduledJsonStore(FILE, buildDefaultState);

function normalizeBotId(botId = "") {
  const normalized = String(botId || "")
    .trim()
    .toLowerCase();

  return normalized || "main";
}

function normalizeOperation(operation = "") {
  const normalized = String(operation || "")
    .trim()
    .toLowerCase();

  return normalized || "unknown";
}

function getOperationKey(botId = "", operation = "") {
  return `${normalizeBotId(botId)}:${normalizeOperation(operation)}`;
}

function ensureEntry(botId = "", operation = "") {
  if (!store.state.operations || typeof store.state.operations !== "object") {
    store.state.operations = {};
  }

  const key = getOperationKey(botId, operation);
  if (!store.state.operations[key] || typeof store.state.operations[key] !== "object") {
    store.state.operations[key] = {
      botId: normalizeBotId(botId),
      operation: normalizeOperation(operation),
      lastSuccessAt: 0,
      lastErroAt: 0,
      lastErroMessage: "",
    };
  }

  return store.state.operations[key];
}

export function getProfileMutationEntry(botId = "", operation = "") {
  return { ...ensureEntry(botId, operation) };
}

export function shouldSkipProfileMutation(botId = "", operation = "", minIntervalMs = 0) {
  const entry = ensureEntry(botId, operation);
  const waitMs = Math.max(0, Number(minIntervalMs || 0));
  const lastSuccessAt = Number(entry.lastSuccessAt || 0);

  if (!waitMs || !lastSuccessAt) {
    return {
      skip: false,
      remainingMs: 0,
      entry: { ...entry },
    };
  }

  const elapsedMs = Math.max(0, Date.now() - lastSuccessAt);
  const remainingMs = Math.max(0, waitMs - elapsedMs);

  return {
    skip: remainingMs > 0,
    remainingMs,
    entry: { ...entry },
  };
}

export function markProfileMutationSuccess(botId = "", operation = "") {
  const entry = ensureEntry(botId, operation);
  entry.lastSuccessAt = Date.now();
  entry.lastErroAt = 0;
  entry.lastErroMessage = "";
  store.scheduleSave?.();
  return { ...entry };
}

export function markProfileMutationFailure(botId = "", operation = "", erro) {
  const entry = ensureEntry(botId, operation);
  entry.lastErroAt = Date.now();
  entry.lastErroMessage = String(erro?.message || erro || "").trim().slice(0, 220);
  store.scheduleSave?.();
  return { ...entry };
}

