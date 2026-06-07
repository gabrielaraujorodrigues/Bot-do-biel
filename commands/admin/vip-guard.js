import fs from "fs";
import path from "path";

const VIP_FILE = path.join(process.cwd(), "settings", "vip.json");

function ensureVipFile() {
  const dir = path.dirname(VIP_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recurseve: true });
  if (!fs.existsSync(VIP_FILE)) fs.writeFileSync(VIP_FILE, JSON.stringify({ users: {} }, null, 2));
}

function readVip() {
  ensureVipFile();
  try {
    const raw = fs.readFileSync(VIP_FILE, "utf-8");
    const data = JSON.parse(raw);
    if (!data.users || typeof data.users !== "object") data.users = {};
    return data;
  } catch {
    return { users: {} };
  }
}

function saveVip(data) {
  try {
    fs.writeFileSync(VIP_FILE, JSON.stringify(data, null, 2));
  } catch {}
}

function normalizeNumber(x) {
  // "51907376960@s.whatsapp.net" -> "51907376960"
  // "51907376960:18@s.whatsapp.net" -> "51907376960"
  // "+51907376960" -> "51907376960"
  return String(x || "")
    .split("@")[0]
    .split(":")[0]
    .replace(/[^\d]/g, "")
    .trim();
}

function getSenderNumber(msg, from) {
  // En grupo: participant, en privado: remoteJid
  const jid = msg?.key?.participant || msg?.participant || msg?.key?.remoteJid || from;
  return normalizeNumber(jid);
}

function getDonos(settings) {
  const donos = [];
  if (Array.isArray(settings?.donoNumbers)) donos.push(...settings.donoNumbers);
  if (typeof settings?.donoNumber === "string") donos.push(settings.donoNumber);
  if (Array.isArray(settings?.donos)) donos.push(...settings.donos);
  if (typeof settings?.dono === "string") donos.push(settings.dono);
  // também por se guardaste botNumber como dono (a veces)
  if (typeof settings?.botNumber === "string") donos.push(settings.botNumber);

  return donos.map(normalizeNumber).filter(Boolean);
}

function isDono({ msg, from, settings }) {
  const sender = getSenderNumber(msg, from);
  const donos = getDonos(settings);
  return donos.includes(sender);
}

/**
 * ✅ Verifica VIP y descuenta 1 uso
 * - Dono: ilimitado (no verifique vencimiento ni usos)
 * - VIP: verifique expiresAt y usesLeft
 */
export function checkVipAndConsume({ msg, from, settings }) {
  // 👑 DONO = ILIMITADO
  if (isDono({ msg, from, settings })) {
    return { ok: true, dono: true, unlimited: true };
  }

  const sender = getSenderNumber(msg, from);
  const data = readVip();
  const info = data.users[sender];

  if (!info) return { ok: false, reason: "no_vip" };

  const now = Date.now();

  // ⏳ vencido
  if (typeof info.expiresAt === "number" && now >= info.expiresAt) {
    delete data.users[sender];
    saveVip(data);
    return { ok: false, reason: "expired" };
  }

  // 🎟️ sen usos
  if (typeof info.usesLeft === "number") {
    if (info.usesLeft <= 0) {
      delete data.users[sender];
      saveVip(data);
      return { ok: false, reason: "limit" };
    }

    // consumir 1 uso
    info.usesLeft -= 1;
    data.users[sender] = info;
    saveVip(data);
  }

  return { ok: true, dono: false, usesLeft: info.usesLeft, expiresAt: info.expiresAt };
}

// (Opçãoal) export por se quieres mostrar tu número detectado
export function debugWhoAmI({ msg, from }) {
  return getSenderNumber(msg, from);
}

