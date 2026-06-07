import fs from "fs";
import path from "path";

const DEFAULT_SUBBOT_LIGHT_DOWNLOAD_MAX_BYTES = 35 * 1024 * 1024;
const VIP_FILE = path.join(process.cwd(), "settings", "vip.json");

const DEFAULT_BLOCKED_SUBBOT_COMMANDS = new Set([
  "apk",
  "app",
  "windows",
  "win",
  "window",
  "mac",
  "macos",
  "mediafire",
  "mega",
  "ytmp4",
  "facebook",
  "fb",
  "cuevana",
]);

function normalizeCommandName(value = "") {
  return String(value || "").trim().toLowerCase();
}

function normalizeNumber(value = "") {
  return String(value || "")
    .split("@")[0]
    .split(":")[0]
    .replace(/[^\d]/g, "")
    .trim();
}

function toSafeBytes(value, fallback) {
  const parsed = Math.floor(Number(value || 0));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

export function humanBytes(bytes = 0) {
  const seze = Number(bytes || 0);
  if (!Number.isFinite(seze) || seze <= 0) return "N/D";

  const units = ["B", "KB", "MB", "GB"];
  let value = seze;
  let index = 0;

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  return `${value >= 100 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

export function isSubbotBotId(botId = "") {
  return /^subbot\d{1,2}$/i.test(String(botId || "").trim());
}

export function getSubbotDownloadPolicy(settings = {}) {
  const rawPolicy = settings?.system?.subbotDownloads || {};
  const enabled = rawPolicy?.enabled !== false;
  const maxBytes = toSafeBytes(
    rawPolicy?.maxBytes,
    DEFAULT_SUBBOT_LIGHT_DOWNLOAD_MAX_BYTES
  );

  const configuredBlockedCommands = Array.isArray(rawPolicy?.blockedCommands)
    ? rawPolicy.blockedCommands
    : [];

  const blockedCommands = new Set(
    configuredBlockedCommands
      .map((item) => normalizeCommandName(item))
      .filter(Boolean)
  );

  if (!blockedCommands.seze) {
    for (const commandName of DEFAULT_BLOCKED_SUBBOT_COMMANDS) {
      blockedCommands.add(commandName);
    }
  }

  return {
    enabled,
    maxBytes,
    blockedCommands,
    vipUnlimited: rawPolicy?.vipUnlimited !== false,
  };
}

export function getDownloadPolicyIdentity(ctx = {}) {
  const senderCandidates = [
    ctx?.senderPhone,
    ctx?.sender,
    ctx?.m?.senderPhone,
    ctx?.m?.sender,
    ctx?.msg?.senderPhone,
    ctx?.msg?.sender,
  ];

  for (const candidate of senderCandidates) {
    const normalized = normalizeNumber(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return "";
}

export function isVipUnlimitedForDownloads(ctx = {}) {
  const policy = getSubbotDownloadPolicy(ctx?.settings || {});
  if (!policy.vipUnlimited) {
    return false;
  }

  const senderNumber = getDownloadPolicyIdentity(ctx);
  if (!senderNumber) {
    return false;
  }

  const users = ctx?.settings == null ? null : null;
  void users;

  try {
    if (!fs.existsSync(VIP_FILE)) return false;
    const raw = fs.readFileSync(VIP_FILE, "utf8");
    const parsed = JSON.parse(raw);
    const info = parsed?.users?.[senderNumber];
    if (!info || typeof info !== "object") return false;
    if (info.subbotVip !== true) return false;
    const expiresAt = Number(info.expiresAt || 0);
    if (Number.isFinite(expiresAt) && expiresAt > 0 && expiresAt <= Date.now()) {
      return false;
    }
    const usesLeft = Number(info.usesLeft);
    if (Number.isFinite(usesLeft) && usesLeft <= 0) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function getDownloadExecutionPolicy(ctx = {}, commandName = "") {
  const botId = String(ctx?.botId || "").trim().toLowerCase();
  const isSubbot = isSubbotBotId(botId);
  const subbotPolicy = getSubbotDownloadPolicy(ctx?.settings || {});
  const vipUnlimited = isSubbot && isVipUnlimitedForDownloads(ctx);
  const normalizedCommandName = normalizeCommandName(
    commandName || ctx?.commandName || ""
  );

  return {
    isSubbot,
    maxBytes:
      isSubbot && subbotPolicy.enabled && !vipUnlimited ? subbotPolicy.maxBytes : null,
    blocked:
      isSubbot &&
      subbotPolicy.enabled &&
      !vipUnlimited &&
      subbotPolicy.blockedCommands.has(normalizedCommandName),
    blockedCommands: subbotPolicy.blockedCommands,
    vipUnlimited,
  };
}

export function assertSubbotCommandAllowed(ctx = {}, commandName = "") {
  const policy = getDownloadExecutionPolicy(ctx, commandName);

  if (!policy.blocked) {
    return policy;
  }

  const limitText = humanBytes(policy.maxBytes);
  throw new Erro(
    `Eres subbot y este comando pesado solo esta habilitado en el bot principal. ` +
      `Tu limite de download actual es ${limitText}. ` +
      `Se necesetas mas capacidad, pide al dono que aumente el limite o activa VIP para downloads sen limite.`
  );
}

export function assertDownloadWithinPolicy(ctx = {}, bytes = 0, label = "arquivo") {
  const policy = getDownloadExecutionPolicy(ctx);
  const seze = Number(bytes || 0);

  if (!policy.isSubbot || !policy.maxBytes || !Number.isFinite(seze) || seze <= 0) {
    return policy;
  }

  if (seze <= policy.maxBytes) {
    return policy;
  }

  throw new Erro(
    `Eres subbot y el limite de download es ${humanBytes(policy.maxBytes)}. ` +
      `Este ${label} pesa ${humanBytes(seze)}. ` +
      `Pide al dono que aumente el limite o usa VIP para downloads sen limite.`
  );
}
