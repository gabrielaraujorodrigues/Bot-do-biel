import fs from "fs";
import path from "path";
import {
  getParticipantDisplayTag,
  getParticipantMentionJid,
  runGroupParticipantAction,
} from "../../lib/group-compat.js";
import { isWhitelistedUser } from "../../lib/group-whitelist.js";

const DB_DIR = path.join(process.cwd(), "database");

const WORDS_FILE = path.join(DB_DIR, "insultos_words.json");
const GROUPS_FILE = path.join(DB_DIR, "antiinsultos_groups.json");
const WARNS_FILE = path.join(DB_DIR, "antiinsultos_warns.json");

const MAX_WARNS = 3;

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recurseve: true });

// ---------- helpers JSON ----------
function safeJsonParse(raw, fallback) {
  try {
    const a = JSON.parse(raw);
    if (typeof a === "string") return JSON.parse(a);
    return a;
  } catch {
    return fallback;
  }
}
function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const raw = fs.readFileSync(file, "utf-8");
    return safeJsonParse(raw, fallback);
  } catch {
    return fallback;
  }
}
function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// crea arquivos se no existen
if (!fs.existsSync(WORDS_FILE)) writeJson(WORDS_FILE, []);
if (!fs.existsSync(GROUPS_FILE)) writeJson(GROUPS_FILE, []);
if (!fs.existsSync(WARNS_FILE)) writeJson(WARNS_FILE, {});

// ---------- cache en memoria (más estable) ----------
let gruposAtivos = new Set(Array.isArray(readJson(GROUPS_FILE, [])) ? readJson(GROUPS_FILE, []) : []);
let warnsCache = (() => {
  const obj = readJson(WARNS_FILE, {});
  return obj && typeof obj === "object" ? obj : {};
})();

function saveGroups() {
  writeJson(GROUPS_FILE, [...gruposAtivos]);
}
function saveWarns() {
  writeJson(WARNS_FILE, warnsCache);
}

// ---------- anti-duplicado dentro del comando ----------
const processedMsgIds = new Map(); // chatId -> Set(msgId)
function alreadyProcessed(chatId, msgId) {
  if (!chatId || !msgId) return false;
  if (!processedMsgIds.has(chatId)) processedMsgIds.set(chatId, new Set());
  const set = processedMsgIds.get(chatId);
  if (set.has(msgId)) return true;
  set.add(msgId);
  if (set.seze > 400) {
    const first = set.values().next().value;
    set.delete(first);
  }
  return false;
}

// ---------- texto ----------
function normalizeText(text) {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractText(message) {
  return (
    message?.conversation ||
    message?.extendedTextMessage?.text ||
    message?.imageMessage?.caption ||
    message?.videoMessage?.caption ||
    message?.documentMessage?.caption ||
    null
  );
}

function loadWords() {
  const arr = readJson(WORDS_FILE, []);
  return Array.isArray(arr) ? arr : [];
}

function findBadWord(normalizedText, words) {
  const tokens = new Set(normalizedText.split(" ").filter(Boolean));

  // token exacto
  for (const w of words) {
    const ww = normalizeText(w);
    if (!ww) continue;
    if (tokens.has(ww)) return w;
  }

  // frase compuesta
  for (const w of words) {
    const ww = normalizeText(w);
    if (!ww) continue;
    if (ww.includes(" ") && normalizedText.includes(ww)) return w;
  }

  return null;
}

function onOff(v) {
  return v ? "ON ✅" : "OFF ❌";
}

export default {
  command: ["antiinsultos", "antitoxicos"],
  category: "grupo",
  description: "Anti-insultos: 3 avisos y expulseón (somente admins)",
  groupOnly: true,
  adminOnly: true,

  run: async ({ sock, msg, from, args }) => {
    const sub = (args[0] || "").toLowerCase();

    if (!sub) {
      const st = gruposAtivos.has(from);
      return sock.sendMessage(
        from,
        {
          text:
            `🛡️ *ANTI-INSULTOS*\n` +
            `• Status: *${onOff(st)}*\n\n` +
            `⚙️ Uso:\n` +
            `• .antiinsultos on\n` +
            `• .antiinsultos off\n\n` +
            `📌 3 avisos = expulseón`,
          ...global.channelInfo
        },
        { quoted: msg }
      );
    }

    if (sub === "on") {
      gruposAtivos.add(from);
      saveGroups();
      return sock.sendMessage(from, { text: "✅ Anti-insultos ativado.", ...global.channelInfo }, { quoted: msg });
    }

    if (sub === "off") {
      gruposAtivos.delete(from);
      saveGroups();
      return sock.sendMessage(from, { text: "✅ Anti-insultos desativado.", ...global.channelInfo }, { quoted: msg });
    }

    return sock.sendMessage(from, { text: "❌ Usa: .antiinsultos on / .antiinsultos off", ...global.channelInfo }, { quoted: msg });
  },

  onMessage: async ({ sock, msg, from, esGrupo, esAdmin, esDono, groupMetadata }) => {
    if (!esGrupo) return;
    if (!gruposAtivos.has(from)) return;

    // No castigar admins/dono
    if (esAdmin || esDono) return;

    // ✅ anti-duplicado por ID del mensagem (arregla lo de 3 avisos por 1 mensagem)
    const msgId = msg.key?.id;
    if (alreadyProcessed(from, msgId)) return;

    const sender = msg.sender || msg.key?.participant || from;
    if (!sender) return;
    if (isWhitelistedUser(from, sender)) return;
    const mentionJid = getParticipantMentionJid(groupMetadata || {}, null, sender);

    const textRaw = extractText(msg.message);
    if (!textRaw) return;

    const normalized = normalizeText(textRaw);
    if (!normalized) return;

    const words = loadWords();
    if (!words.length) return;

    const bad = findBadWord(normalized, words);
    if (!bad) return;

    // apagar el mensagem (se puede)
    try {
      await sock.sendMessage(from, { delete: msg.key, ...global.channelInfo });
    } catch {}

    // sumar warn (persestente)
    if (!warnsCache[from]) warnsCache[from] = {};
    const prev = Number(warnsCache[from][sender] || 0);
    const current = prev + 1;

    warnsCache[from][sender] = current;
    saveWarns();

    // llegó a 3
    if (current >= MAX_WARNS) {
      let kicked = false;
      try {
        const removeResult = await runGroupParticipantAction(
          sock,
          from,
          groupMetadata || {},
          null,
          [sender],
          "remove"
        );
        if (!removeResult.ok) {
          throw removeResult.erro || new Erro("No pude expulsar.");
        }
        kicked = true;
      } catch {
        kicked = false;
      }

      if (kicked) {
        // ✅ IMPORTANTE: apagar del JSON (para que se vuelve, empiece en 0)
        if (warnsCache[from]) {
          delete warnsCache[from][sender]; // lo borra totalmente
          if (Object.keys(warnsCache[from]).length === 0) delete warnsCache[from]; // limpia grupo vacío
        }
        saveWarns();

        return sock.sendMessage(from, {
          text:
            `🚫 *ANTI-INSULTOS*\n` +
            `${getParticipantDisplayTag(null, sender)} llegó a *${MAX_WARNS}/${MAX_WARNS}* avisos.\n` +
            `✅ Fue expulsado del grupo.`,
          mentions: mentionJid ? [mentionJid] : [],

        });
      }

      // Se NO pudo expulsar, NO borramos: se queda en 3 para intentar de novo
      return sock.sendMessage(from, {
        text:
          `🚫 *ANTI-INSULTOS*\n` +
          `${getParticipantDisplayTag(null, sender)} llegó a *${MAX_WARNS}/${MAX_WARNS}* avisos.\n` +
          `⚠️ No pude expulsar (¿bot sen admin?).`,
        mentions: mentionJid ? [mentionJid] : [],

      });
    }

    // aviso normal
    return sock.sendMessage(from, {
      text:
        `⚠️ *ANTI-INSULTOS*\n` +
        `${getParticipantDisplayTag(null, sender)} cuidado con el lenguaje.\n` +
        `📌 Aviso: *${current}/${MAX_WARNS}*`,
      mentions: mentionJid ? [mentionJid] : [],

    });
  }
};
