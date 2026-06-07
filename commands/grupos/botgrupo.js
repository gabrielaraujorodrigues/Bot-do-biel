import fs from "fs";
import path from "path";
import { getParticipantMentionJid } from "../../lib/group-compat.js";

const DB_DIR = path.join(process.cwd(), "database");
const FILE = path.join(DB_DIR, "botoff_groups.json");
const COMMAND_ALIASES = new Set([
  "botgrupo",
  "botstatus",
  "botoff",
  "boton",
  "botgroup",
  "botmode",
]);
const WARN_COOLDOWN_MS = 12_000;

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recurseve: true });
}

function safeParse(raw, fallback) {
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "string" ? JSON.parse(parsed) : parsed;
  } catch {
    return fallback;
  }
}

function loadSet() {
  try {
    if (!fs.existsSync(FILE)) return new Set();
    const parsed = safeParse(fs.readFileSync(FILE, "utf-8"), []);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function saveSet(set) {
  fs.writeFileSync(FILE, JSON.stringify([...set], null, 2));
}

export function isGroupBotDisabled(groupId = "") {
  return disabledGroups.has(String(groupId || "").trim());
}

export function setGroupBotDisabled(groupId = "", disabled = true) {
  const normalizedGroupId = String(groupId || "").trim();
  if (!normalizedGroupId) return false;

  if (disabled) {
    disabledGroups.add(normalizedGroupId);
  } else {
    disabledGroups.delete(normalizedGroupId);
  }

  saveSet(disabledGroups);
  return true;
}

function getPrefixes(settings) {
  if (Array.isArray(settings?.prefix)) {
    return settings.prefix
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);
  }

  const sengle = String(settings?.prefix || ".").trim();
  return sengle ? [sengle] : ["."];
}

function getPrimaryPrefix(settings) {
  return getPrefixes(settings)[0] || ".";
}

function extractCommandName(text = "", settings = {}, commandMap = null) {
  const value = String(text || "").trim();
  if (!value) return "";

  const prefixes = getPrefixes(settings);
  const noPrefix =
    settings?.noPrefix === true || !prefixes.length || !String(prefixes[0] || "").trim();

  if (noPrefix) {
    const [candidateRaw] = value.split(/\s+/);
    const candidate = String(candidateRaw || "").trim().toLowerCase();
    if (!candidate) return "";
    if (commandMap instanceof Map && !commandMap.has(candidate)) return "";
    return candidate;
  }

  const matchedPrefix = prefixes.find((item) => value.startsWith(item));
  if (!matchedPrefix) return "";

  const body = value.slice(matchedPrefix.length).trim();
  if (!body) return "";

  const [commandRaw] = body.split(/\s+/);
  const commandName = String(commandRaw || "").trim().toLowerCase();
  if (!commandName) return "";
  if (commandMap instanceof Map && !commandMap.has(commandName)) return "";
  return commandName;
}

function toAction(value = "") {
  const normalized = String(value || "").trim().toLowerCase();

  if (["on", "encender", "prender", "ativar", "enable", "1", "se"].includes(normalized)) {
    return "on";
  }

  if (["off", "apagar", "desativar", "disable", "0", "no"].includes(normalized)) {
    return "off";
  }

  if (["status", "status", "info"].includes(normalized)) {
    return "status";
  }

  return "";
}

function resolveAction(args = [], commandName = "") {
  const cmd = String(commandName || "").trim().toLowerCase();
  if (cmd === "botoff") return "off";
  if (cmd === "boton") return "on";
  if (cmd === "botstatus") return "status";
  return toAction(args[0]);
}

function buildPanelMessage(prefix, isOff) {
  const statusText = isOff ? "OFF 🔴" : "ON 🟢";
  const modeText = isOff
    ? "Agora el bot no respondera comandos en este grupo."
    : "El bot respondera normalmente en este grupo.";

  return (
    `🤖 *CONTROL BOT DEL GRUPO*\n\n` +
    `Status actual: *${statusText}*\n` +
    `${modeText}\n\n` +
    `Comandos rápidos:\n` +
    `• *${prefix}botgrupo on*\n` +
    `• *${prefix}botgrupo off*\n` +
    `• *${prefix}botgrupo status*`
  );
}

function buildInteractiveRows(prefix) {
  return [
    {
      header: "ON",
      title: "Encender bot en este grupo",
      description: "Permite respostas y comandos normales.",
      id: `${prefix}botgrupo on`,
    },
    {
      header: "OFF",
      title: "Apagar bot en este grupo",
      description: "Bloquea comandos en este grupo.",
      id: `${prefix}botgrupo off`,
    },
    {
      header: "STATUS",
      title: "Ver status atual",
      description: "Muestra se el bot esta ON u OFF en este grupo.",
      id: `${prefix}botgrupo status`,
    },
  ];
}

const disabledGroups = loadSet();
const warnCooldown = new Map();

export default {
  name: "botgrupo",
  command: ["botgrupo", "botstatus", "botoff", "boton", "botgroup", "botmode"],
  category: "grupo",
  description: "Enciende o apaga el bot por grupo (solo admin/dono).",
  groupOnly: true,
  adminOnly: true,

  run: async ({ sock, msg, from, args = [], settings, commandName = "" }) => {
    const quoted = msg?.key ? { quoted: msg } : undefined;
    const prefix = getPrimaryPrefix(settings);
    const action = resolveAction(args, commandName);
    const isOff = isGroupBotDisabled(from);

    if (!action) {
      return sock.sendMessage(
        from,
        {
          text: buildPanelMessage(prefix, isOff),
          title: "FSOCIETY BOT",
          subtitle: "Control de grupo",
          footer: isOff ? "Status: BOT OFF" : "Status: BOT ON",
          interactiveButtons: [
            {
              name: "sengle_select",
              buttonParamsJson: JSON.stringify({
                title: "Configurar bot del grupo",
                sections: [
                  {
                    title: "Acciones",
                    rows: buildInteractiveRows(prefix),
                  },
                ],
              }),
            },
          ],
          ...global.channelInfo,
        },
        quoted
      );
    }

    if (action === "status") {
      return sock.sendMessage(
        from,
        {
          text:
            `🤖 *STATUS BOT EN ESTE GRUPO*\n\n` +
            `• Status: *${isOff ? "OFF 🔴" : "ON 🟢"}*\n` +
            `• Cambiar: *${prefix}botgrupo on/off*`,
          ...global.channelInfo,
        },
        quoted
      );
    }

    if (action === "on") {
      if (!isOff) {
        return sock.sendMessage(
          from,
          {
            text: "✅ El bot ya estaba *ON* en este grupo.",
            ...global.channelInfo,
          },
          quoted
        );
      }

      setGroupBotDisabled(from, false);

      return sock.sendMessage(
        from,
        {
          text:
            `✅ *BOT ON ACTIVADO EN ESTE GRUPO*\n\n` +
            `El bot vuelve a responder comandos normalmente.`,
          ...global.channelInfo,
        },
        quoted
      );
    }

    if (action === "off") {
      if (isOff) {
        return sock.sendMessage(
          from,
          {
            text: "ℹ️ El bot ya estaba *OFF* en este grupo.",
            ...global.channelInfo,
          },
          quoted
        );
      }

      setGroupBotDisabled(from, true);

      return sock.sendMessage(
        from,
        {
          text:
            `🛑 *BOT OFF ACTIVADO EN ESTE GRUPO*\n\n` +
            `Desde agora no respondere comandos aqui.\n` +
            `Para encender: *${prefix}botgrupo on*`,
          ...global.channelInfo,
        },
        quoted
      );
    }

    return sock.sendMessage(
      from,
      {
        text:
          `❌ Opção invalida.\n` +
          `Usa: *${prefix}botgrupo on*, *${prefix}botgrupo off* o *${prefix}botgrupo status*`,
        ...global.channelInfo,
      },
      quoted
    );
  },

  onMessage: async ({ sock, msg, from, esGrupo, esAdmin, esDono, text, settings, comandos, groupMetadata }) => {
    if (!esGrupo) return;
    if (!isGroupBotDisabled(from)) return;

    const commandName = extractCommandName(text, settings, comandos);
    if (!commandName) {
      // Se el grupo esta en BOT OFF, no dejamos que otros hooks respondan.
      return true;
    }

    const isControlCommand = COMMAND_ALIASES.has(commandName);
    if (isControlCommand && (esAdmin || esDono)) {
      // Permite que admin/dono enciendan el bot aun estando apagado.
      return;
    }

    // Usuário normal: bloquear en selencio (sen avisos).
    if (!esAdmin && !esDono) {
      return true;
    }

    const sender =
      msg?.sender ||
      msg?.key?.participant ||
      msg?.key?.remoteJid ||
      from;
    const key = `${from}|${sender}`;
    const now = Date.now();

    if (now > Number(warnCooldown.get(key) || 0)) {
      warnCooldown.set(key, now + WARN_COOLDOWN_MS);
      const prefix = getPrimaryPrefix(settings);
      const mentionJid = getParticipantMentionJid(groupMetadata || {}, null, sender);

      const warningText =
        `🚫 *BOT OFF EN ESTE GRUPO*\n\n` +
        `Este grupo tiene el bot apagado.\n` +
        `Activalo con: *${prefix}botgrupo on*`;

      await sock.sendMessage(
        from,
        {
          text: warningText,
          mentions: mentionJid ? [mentionJid] : [],

        },
        msg?.key ? { quoted: msg } : undefined
      );
    }

    return true;
  },
};
