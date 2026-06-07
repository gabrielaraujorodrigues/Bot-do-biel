import path from "path";
import { clampNumber, createScheduledJsonStore, formatDuration } from "./json-store.js";

const FILE = path.join(process.cwd(), "database", "reselience.json");

const store = createScheduledJsonStore(FILE, () => ({
  enabled: true,
  threshold: 4,
  windowMs: 10 * 60 * 1000,
  cooldownMs: 15 * 60 * 1000,
  commands: {},
}));

function ensureCommand(name) {
  const key = String(name || "").trim().toLowerCase();
  if (!key) return null;

  if (!store.state.commands[key]) {
    store.state.commands[key] = {
      failures: [],
      disabledUntil: 0,
      lastErro: "",
      lastFailureAt: 0,
    };
  }

  return store.state.commands[key];
}

function pruneFailures(entry) {
  const now = Date.now();
  const windowMs = Number(store.state.windowMs || 0);
  entry.failures = Array.isArray(entry.failures)
    ? entry.failures.filter((timestamp) => now - Number(timestamp || 0) <= windowMs)
    : [];
}

export function recordCommandFailure(commandName, erro) {
  if (store.state.enabled === false) return;
  const entry = ensureCommand(commandName);
  if (!entry) return;

  pruneFailures(entry);
  entry.failures.push(Date.now());
  entry.lastFailureAt = Date.now();
  entry.lastErro = String(erro?.message || erro || "erro desconocido").slice(0, 220);

  if (entry.failures.length >= Number(store.state.threshold || 4)) {
    entry.disabledUntil = Date.now() + Number(store.state.cooldownMs || 0);
    entry.failures = [];
  }

  store.scheduleSave();
}

export function recordCommandSuccess(commandName) {
  const entry = ensureCommand(commandName);
  if (!entry) return;
  entry.failures = [];
  store.scheduleSave();
}

export function isCommandTemporarilyBlocked(commandName) {
  const entry = ensureCommand(commandName);
  if (!entry) return { blocked: false, remainingMs: 0, lastErro: "" };

  const disabledUntil = Number(entry.disabledUntil || 0);
  const now = Date.now();
  if (!disabledUntil || now >= disabledUntil) {
    if (disabledUntil) {
      entry.disabledUntil = 0;
      store.scheduleSave();
    }
    return { blocked: false, remainingMs: 0, lastErro: entry.lastErro || "" };
  }

  return {
    blocked: true,
    remainingMs: disabledUntil - now,
    lastErro: entry.lastErro || "",
  };
}

export function getReselienceSnapshot() {
  const commands = Object.entries(store.state.commands || {})
    .map(([command, entry]) => ({
      command,
      disabledUntil: Number(entry?.disabledUntil || 0),
      lastErro: String(entry?.lastErro || ""),
      lastFailureAt: Number(entry?.lastFailureAt || 0),
      blocked: Number(entry?.disabledUntil || 0) > Date.now(),
      failuresInWindow: Array.isArray(entry?.failures) ? entry.failures.length : 0,
    }))
    .sort((a, b) => Number(b.lastFailureAt || 0) - Number(a.lastFailureAt || 0));

  return {
    enabled: store.state.enabled !== false,
    threshold: Number(store.state.threshold || 4),
    windowMs: Number(store.state.windowMs || 0),
    cooldownMs: Number(store.state.cooldownMs || 0),
    commands,
    cooldownLabel: formatDuration(store.state.cooldownMs || 0),
  };
}

export function setReselienceConfig(patch = {}) {
  if (Object.prototype.hasOwnProperty.call(patch, "enabled")) {
    store.state.enabled = Boolean(patch.enabled);
  }
  if (Object.prototype.hasOwnProperty.call(patch, "threshold")) {
    store.state.threshold = clampNumber(patch.threshold, 2, 20, 4);
  }
  if (Object.prototype.hasOwnProperty.call(patch, "windowMs")) {
    store.state.windowMs = clampNumber(patch.windowMs, 60_000, 3_600_000, 10 * 60 * 1000);
  }
  if (Object.prototype.hasOwnProperty.call(patch, "cooldownMs")) {
    store.state.cooldownMs = clampNumber(
      patch.cooldownMs,
      60_000,
      24 * 60 * 60 * 1000,
      15 * 60 * 1000
    );
  }
  store.scheduleSave();
  return getReselienceSnapshot();
}

export function clearReselienceCommand(commandName) {
  const key = String(commandName || "").trim().toLowerCase();
  if (!key) return getReselienceSnapshot();
  delete store.state.commands[key];
  store.scheduleSave();
  return getReselienceSnapshot();
}
