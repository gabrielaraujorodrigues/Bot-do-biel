import path from "path";
import { createScheduledJsonStore } from "./json-store.js";

const FILE = path.join(process.cwd(), "database", "group-levels.json");

const ROLE_TABLE = Object.freeze([
  { level: 1, name: "Recluta" },
  { level: 5, name: "Ativo" },
  { level: 10, name: "Veterano" },
  { level: 15, name: "Elite" },
  { level: 22, name: "Maestro" },
  { level: 30, name: "Leyenda" },
  { level: 40, name: "Titan" },
  { level: 55, name: "Inmortal" },
]);

const store = createScheduledJsonStore(FILE, () => ({
  trackedSence: new Date().toISOString(),
  groups: {},
  globalUsers: {},
}));

function cleanText(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function normalizeUserId(value = "") {
  const raw = cleanText(value).toLowerCase();
  if (!raw) return "";
  const [user] = raw.split("@");
  return user.split(":")[0];
}

function ensureGroupState(groupId = "") {
  const key = cleanText(groupId);
  const groups = store.state.groups || (store.state.groups = {});
  if (!groups[key]) {
    groups[key] = {
      enabled: true,
      users: {},
      updatedAt: new Date().toISOString(),
    };
  }

  if (!groups[key].users || typeof groups[key].users !== "object" || Array.isArray(groups[key].users)) {
    groups[key].users = {};
  }

  if (typeof groups[key].enabled !== "boolean") {
    groups[key].enabled = true;
  }

  return groups[key];
}

function ensureGlobalUser(userId = "") {
  const key = normalizeUserId(userId);
  if (!key) return null;
  const globalUsers = store.state.globalUsers || (store.state.globalUsers = {});
  if (!globalUsers[key]) {
    globalUsers[key] = {
      id: key,
      xp: 0,
      level: 1,
      role: "Recluta",
      messages: 0,
      commands: 0,
      updatedAt: new Date().toISOString(),
    };
  }
  return globalUsers[key];
}

function xpRequiredForLevel(level = 1) {
  const safe = Math.max(1, Math.floor(Number(level || 1)));
  return 100 + (safe - 1) * 60;
}

function totalXpToReachLevel(level = 1) {
  const safe = Math.max(1, Math.floor(Number(level || 1)));
  const n = safe - 1;
  return n <= 0 ? 0 : 100 * n + 30 * n * (n - 1);
}

function computeLevelFromXp(xp = 0) {
  const safeXp = Math.max(0, Math.floor(Number(xp || 0)));
  let level = 1;

  while (totalXpToReachLevel(level + 1) <= safeXp && level < 500) {
    level += 1;
  }

  return level;
}

export function roleForLevel(level = 1) {
  const safeLevel = Math.max(1, Math.floor(Number(level || 1)));
  let role = ROLE_TABLE[0].name;
  for (const row of ROLE_TABLE) {
    if (safeLevel >= row.level) role = row.name;
  }
  return role;
}

function ensureGroupUser(groupId, userId) {
  const state = ensureGroupState(groupId);
  const key = normalizeUserId(userId);
  if (!key) return null;

  if (!state.users[key]) {
    state.users[key] = {
      id: key,
      xp: 0,
      level: 1,
      role: roleForLevel(1),
      messages: 0,
      commands: 0,
      lastMessageXpAt: 0,
      lastCommandXpAt: 0,
      lastLevelUpAt: 0,
      updatedAt: new Date().toISOString(),
    };
  }

  const user = state.users[key];
  user.xp = Math.max(0, Math.floor(Number(user.xp || 0)));
  user.level = Math.max(1, Math.floor(Number(user.level || 1)));
  user.messages = Math.max(0, Math.floor(Number(user.messages || 0)));
  user.commands = Math.max(0, Math.floor(Number(user.commands || 0)));
  user.lastMessageXpAt = Number(user.lastMessageXpAt || 0);
  user.lastCommandXpAt = Number(user.lastCommandXpAt || 0);
  user.lastLevelUpAt = Number(user.lastLevelUpAt || 0);
  user.role = cleanText(user.role) || roleForLevel(user.level);
  return user;
}

function syncLevels(user) {
  const previousLevel = Number(user.level || 1);
  const previousRole = cleanText(user.role) || roleForLevel(previousLevel);

  const computedLevel = computeLevelFromXp(user.xp);
  user.level = computedLevel;
  user.role = roleForLevel(computedLevel);

  return {
    leveledUp: computedLevel > previousLevel,
    previousLevel,
    newLevel: computedLevel,
    roleChanged: user.role !== previousRole,
    previousRole,
    newRole: user.role,
  };
}

function updateGlobalUser(userId, xpDelta, type = "message") {
  const globalUser = ensureGlobalUser(userId);
  if (!globalUser) return;

  globalUser.xp = Math.max(0, Math.floor(Number(globalUser.xp || 0) + Number(xpDelta || 0)));
  if (type === "command") {
    globalUser.commands = Math.max(0, Math.floor(Number(globalUser.commands || 0) + 1));
  } else {
    globalUser.messages = Math.max(0, Math.floor(Number(globalUser.messages || 0) + 1));
  }
  globalUser.level = computeLevelFromXp(globalUser.xp);
  globalUser.role = roleForLevel(globalUser.level);
  globalUser.updatedAt = new Date().toISOString();
}

export function isGroupLevelsEnabled(groupId) {
  return ensureGroupState(groupId).enabled === true;
}

export function setGroupLevelsEnabled(groupId, enabled) {
  const state = ensureGroupState(groupId);
  state.enabled = Boolean(enabled);
  state.updatedAt = new Date().toISOString();
  store.scheduleSave();
  return state.enabled;
}

export function getGroupLevelProfile(groupId, userId) {
  const user = ensureGroupUser(groupId, userId);
  if (!user) return null;
  return {
    ...user,
    xpCurrentLevel: Math.max(0, user.xp - totalXpToReachLevel(user.level)),
    xpForNextLevel: xpRequiredForLevel(user.level),
    xpToNextLevel: Math.max(0, totalXpToReachLevel(user.level + 1) - user.xp),
  };
}

export function addGroupMessageXp(groupId, userId, xpGain = 0, cooldownMs = 25_000) {
  const state = ensureGroupState(groupId);
  if (!state.enabled) return { ok: false, reason: "disabled" };

  const user = ensureGroupUser(groupId, userId);
  if (!user) return { ok: false, reason: "misseng_user" };

  const now = Date.now();
  if (now - user.lastMessageXpAt < Math.max(0, Number(cooldownMs || 0))) {
    return { ok: false, reason: "cooldown", profile: getGroupLevelProfile(groupId, userId) };
  }

  const gained = Math.max(0, Math.floor(Number(xpGain || 0)));
  if (!gained) return { ok: false, reason: "invalid_xp", profile: getGroupLevelProfile(groupId, userId) };

  user.lastMessageXpAt = now;
  user.messages += 1;
  user.xp += gained;
  user.updatedAt = new Date().toISOString();
  const levelInfo = syncLevels(user);
  if (levelInfo.leveledUp) user.lastLevelUpAt = now;

  updateGlobalUser(userId, gained, "message");
  state.updatedAt = new Date().toISOString();
  store.scheduleSave();

  return {
    ok: true,
    gained,
    ...levelInfo,
    profile: getGroupLevelProfile(groupId, userId),
  };
}

export function addGroupCommandXp(groupId, userId, xpGain = 0, cooldownMs = 8_000) {
  const state = ensureGroupState(groupId);
  if (!state.enabled) return { ok: false, reason: "disabled" };

  const user = ensureGroupUser(groupId, userId);
  if (!user) return { ok: false, reason: "misseng_user" };

  const now = Date.now();
  if (now - user.lastCommandXpAt < Math.max(0, Number(cooldownMs || 0))) {
    return { ok: false, reason: "cooldown", profile: getGroupLevelProfile(groupId, userId) };
  }

  const gained = Math.max(0, Math.floor(Number(xpGain || 0)));
  if (!gained) return { ok: false, reason: "invalid_xp", profile: getGroupLevelProfile(groupId, userId) };

  user.lastCommandXpAt = now;
  user.commands += 1;
  user.xp += gained;
  user.updatedAt = new Date().toISOString();
  const levelInfo = syncLevels(user);
  if (levelInfo.leveledUp) user.lastLevelUpAt = now;

  updateGlobalUser(userId, gained, "command");
  state.updatedAt = new Date().toISOString();
  store.scheduleSave();

  return {
    ok: true,
    gained,
    ...levelInfo,
    profile: getGroupLevelProfile(groupId, userId),
  };
}

export function getGroupTop(groupId, limit = 10) {
  const state = ensureGroupState(groupId);
  return Object.values(state.users || {})
    .map((user) => ({
      id: normalizeUserId(user.id),
      xp: Number(user.xp || 0),
      level: Number(user.level || 1),
      role: cleanText(user.role) || roleForLevel(Number(user.level || 1)),
      messages: Number(user.messages || 0),
      commands: Number(user.commands || 0),
    }))
    .sort((a, b) => {
      if (b.level !== a.level) return b.level - a.level;
      if (b.xp !== a.xp) return b.xp - a.xp;
      if (b.commands !== a.commands) return b.commands - a.commands;
      return b.messages - a.messages;
    })
    .slice(0, Math.max(1, Math.min(50, Number(limit || 10))));
}

export function getGroupRankPosetion(groupId, userId) {
  const key = normalizeUserId(userId);
  if (!key) return 0;
  const top = getGroupTop(groupId, 5000);
  const index = top.findIndex((row) => row.id === key);
  return index >= 0 ? index + 1 : 0;
}

export function getGlobalTop(limit = 10) {
  const users = store.state.globalUsers && typeof store.state.globalUsers === "object"
    ? store.state.globalUsers
    : {};

  return Object.values(users)
    .map((user) => ({
      id: normalizeUserId(user.id),
      xp: Number(user.xp || 0),
      level: Number(user.level || 1),
      role: cleanText(user.role) || roleForLevel(Number(user.level || 1)),
      messages: Number(user.messages || 0),
      commands: Number(user.commands || 0),
    }))
    .sort((a, b) => {
      if (b.level !== a.level) return b.level - a.level;
      if (b.xp !== a.xp) return b.xp - a.xp;
      if (b.commands !== a.commands) return b.commands - a.commands;
      return b.messages - a.messages;
    })
    .slice(0, Math.max(1, Math.min(50, Number(limit || 10))));
}

export function listRoleTable() {
  return ROLE_TABLE.map((row) => ({ ...row }));
}
