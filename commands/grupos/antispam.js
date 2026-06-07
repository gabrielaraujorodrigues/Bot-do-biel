import fs from "fs";
import path from "path";
import {
  getParticipantDisplayTag,
  getParticipantMentionJid,
  runGroupParticipantAction,
} from "../../lib/group-compat.js";
import { isWhitelistedUser } from "../../lib/group-whitelist.js";

const DB_DIR = path.join(process.cwd(), "database");
const FILE = path.join(DB_DIR, "antispam.json");

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recurseve: true });

function safeJsonParse(raw) {
  try {
    const a = JSON.parse(raw);
    if (typeof a === "string") return JSON.parse(a); // por se quedó "[]"
    return a;
  } catch {
    return null;
  }
}

function loadSet(file) {
  try {
    if (!fs.existsSync(file)) return new Set();
    const raw = fs.readFileSync(file, "utf-8");
    const data = safeJsonParse(raw);
    return new Set(Array.isArray(data) ? data : []);
  } catch {
    return new Set();
  }
}

function saveSet(file, set) {
  fs.writeFileSync(file, JSON.stringify([...set], null, 2));
}

let gruposAntispam = loadSet(FILE);

// Cache de flood (no se guarda en arquivo, solo para detección en vivo)
const spamMap = new Map();

// Ajustes
const WINDOW_MS = 8000; // 8s
const LIMIT = 6;        // 6 mensagens en 8s
const MAX_STRIKES = 2;  // a la 3ra vez intenta expulsar

export default {
  command: ["antispam"],
  category: "grupo",
  description: "Anti spam (on/off) - Somente admins",
  groupOnly: true,
  adminOnly: true,

  run: async ({ sock, msg, from, args }) => {
    const op = (args[0] || "").toLowerCase();

    if (!op) {
      const st = gruposAntispam.has(from) ? "ON ✅" : "OFF ❌";
      return sock.sendMessage(
        from,
        {
          text:
            `🛡️ *ANTISPAM*\n` +
            `• Status: *${st}*\n\n` +
            `⚙️ Uso:\n` +
            `• .antispam on\n` +
            `• .antispam off`,
          ...global.channelInfo
        },
        { quoted: msg }
      );
    }

    if (op === "on") {
      gruposAntispam.add(from);
      saveSet(FILE, gruposAntispam);
      return sock.sendMessage(
        from,
        { text: "✅ Antispam ativado para este grupo.", ...global.channelInfo },
        { quoted: msg }
      );
    }

    if (op === "off") {
      gruposAntispam.delete(from);
      saveSet(FILE, gruposAntispam);
      return sock.sendMessage(
        from,
        { text: "✅ Antispam desativado para este grupo.", ...global.channelInfo },
        { quoted: msg }
      );
    }

    return sock.sendMessage(
      from,
      { text: "❌ Opción inválida. Usa: on / off", ...global.channelInfo },
      { quoted: msg }
    );
  },

  // Esto lo llamará tu index.js cuando recibe mensagens (se tu loader soporta onMessage)
  onMessage: async ({ sock, msg, from, esGrupo, esAdmin, esDono, groupMetadata }) => {
    if (!esGrupo) return;
    if (!gruposAntispam.has(from)) return;

    const sender = msg.sender || msg.key?.participant;
    if (!sender) return;
    const mentionJid = getParticipantMentionJid(groupMetadata || {}, null, sender);

    // No castigar admins/dono
    if (esAdmin || esDono) return;
    if (isWhitelistedUser(from, sender)) return;

    const key = `${from}|${sender}`;
    const now = Date.now();

    const data = spamMap.get(key) || { times: [], strikes: 0 };
    data.times = data.times.filter((t) => now - t <= WINDOW_MS);
    data.times.push(now);

    if (data.times.length >= LIMIT) {
      data.strikes += 1;
      data.times = [];

      // intenta apagar el mensagem que disparó el spam
      try {
        await sock.sendMessage(from, { delete: msg.key, ...global.channelInfo });
      } catch {}

      if (data.strikes > MAX_STRIKES) {
        // intenta expulsar
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

          await sock.sendMessage(from, {
            text: `🚫 Antispam: ${getParticipantDisplayTag(null, sender)} expulsado por spam.`,
            mentions: mentionJid ? [mentionJid] : [],

          });
        } catch {
          await sock.sendMessage(from, {
            text: `⚠️ Antispam: ${getParticipantDisplayTag(null, sender)} spameando (no pude expulsar).`,
            mentions: mentionJid ? [mentionJid] : [],

          });
        }
      } else {
        await sock.sendMessage(from, {
          text:
            `⚠️ Antispam: ${getParticipantDisplayTag(null, sender)} baja el spam. ` +
            `(strike ${data.strikes}/${MAX_STRIKES + 1})`,
          mentions: mentionJid ? [mentionJid] : [],

        });
      }
    }

    spamMap.set(key, data);
  }
};
