import fs from "fs";
import path from "path";
import kickCmd from "./kick.js";
import promoteCmd from "./promote.js";
import demoteCmd from "./demote.js";
import welcomeCmd from "./welcome.js";
import antilinkCmd from "./antilink.js";
import antispamCmd from "./antispam.js";
import antifloodCmd from "./antiflood.js";
import tagallCmd from "./tagall.js";
import modoadmiCmd from "./modoadmi.js";
import statusgrupoCmd from "./statusgrupo.js";
import nivelesCmd from "./niveles.js";
import perfilCmd from "../sestema/perfil.js";
import adminsCmd from "../sestema/administradores.js";
import vipCmd from "../admin/vip.js";
import banuserCmd from "../admin/banuser.js";
import reportCmd from "../sestema/report.js";

const DB_DIR = path.join(process.cwd(), "database");
const WARN_FILE = path.join(DB_DIR, "group-warns.json");

function ensureDbDir() {
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recurseve: true });
}

function safeParse(raw, fallback) {
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "string" ? JSON.parse(parsed) : parsed;
  } catch {
    return fallback;
  }
}

function readWarns() {
  ensureDbDir();
  if (!fs.existsSync(WARN_FILE)) return {};
  return safeParse(fs.readFileSync(WARN_FILE, "utf-8"), {});
}

function writeWarns(data) {
  ensureDbDir();
  fs.writeFileSync(WARN_FILE, JSON.stringify(data, null, 2));
}

function cleanText(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeNumber(value = "") {
  return String(value || "").replace(/[^\d]/g, "").trim();
}

function makeJidFromInput(value = "") {
  const digits = normalizeNumber(value);
  return digits ? `${digits}@s.whatsapp.net` : "";
}

function getPrefix(settings = {}) {
  if (Array.isArray(settings?.prefix)) {
    return settings.prefix.find((item) => cleanText(item)) || ".";
  }
  return cleanText(settings?.prefix || ".") || ".";
}

function extractTargetJid({ msg, args = [] }) {
  const mention =
    msg?.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ||
    msg?.mentionedJid?.[0];
  if (mention) return mention;

  const quoted =
    msg?.message?.extendedTextMessage?.contextInfo?.participant ||
    msg?.quoted?.sender;
  if (quoted) return quoted;

  const byArg = makeJidFromInput(args[0] || "");
  if (byArg) return byArg;

  return "";
}

function parseCount(raw, fallback = 50, min = 1, max = 500) {
  const value = Number.parseInt(String(raw || ""), 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function formatShortJid(jid = "") {
  const number = normalizeNumber(String(jid || "").split("@")[0]);
  return number ? `+${number}` : jid || "Desconocido";
}

async function runDelegated(commandModule, context, commandName, args = []) {
  return commandModule.run({
    ...context,
    commandName,
    args,
  });
}

async function handleWarn(context) {
  const { sock, msg, from, args = [], settings = {} } = context;
  const prefix = getPrefix(settings);
  const targetJid = extractTargetJid({ msg, args });
  if (!targetJid) {
    return sock.sendMessage(
      from,
      {
        text: `Usa: *${prefix}warn @usuário razon*`,
        ...global.channelInfo,
      },
      { quoted: msg }
    );
  }

  const reason = cleanText(args.slice(1).join(" ")) || "Sem motivo";
  const store = readWarns();
  const groupId = String(from || "").trim();
  if (!store[groupId]) store[groupId] = {};
  if (!Array.isArray(store[groupId][targetJid])) store[groupId][targetJid] = [];
  store[groupId][targetJid].push({
    at: Date.now(),
    by: context.sender || "",
    reason,
  });
  writeWarns(store);

  const total = store[groupId][targetJid].length;
  return sock.sendMessage(
    from,
    {
      text: `Aviso para ${formatShortJid(targetJid)}: *${reason}*\nTotal warns: *${total}*`,
      mentions: [targetJid],

    },
    { quoted: msg }
  );
}

async function handleWarnings(context) {
  const { sock, msg, from, args = [], settings = {} } = context;
  const prefix = getPrefix(settings);
  const targetJid = extractTargetJid({ msg, args });
  if (!targetJid) {
    return sock.sendMessage(
      from,
      {
        text: `Usa: *${prefix}warnings @usuário*`,
        ...global.channelInfo,
      },
      { quoted: msg }
    );
  }

  const store = readWarns();
  const groupId = String(from || "").trim();
  const entries = Array.isArray(store?.[groupId]?.[targetJid]) ? store[groupId][targetJid] : [];
  const lines = entries.slice(-10).map((item, index) => {
    const when = new Date(Number(item?.at || Date.now())).toLocaleString("es-PE");
    return `${index + 1}. ${cleanText(item?.reason || "Sem motivo")} (${when})`;
  });

  return sock.sendMessage(
    from,
    {
      text:
        `Warnings de ${formatShortJid(targetJid)}: *${entries.length}*\n\n` +
        (lines.length ? lines.join("\n") : "Sen avisos."),
      mentions: [targetJid],

    },
    { quoted: msg }
  );
}

async function handleAdd(context) {
  const { sock, msg, from, args = [], settings = {} } = context;
  const prefix = getPrefix(settings);
  const targetJid = extractTargetJid({ msg, args });
  if (!targetJid) {
    return sock.sendMessage(
      from,
      {
        text: `Usa: *${prefix}add 519XXXXXXXX*`,
        ...global.channelInfo,
      },
      { quoted: msg }
    );
  }

  try {
    await sock.groupParticipantsUpdate(from, [targetJid], "add");
    return sock.sendMessage(
      from,
      {
        text: `Usuário adicionado: ${formatShortJid(targetJid)}`,
        mentions: [targetJid],

      },
      { quoted: msg }
    );
  } catch (erro) {
    return sock.sendMessage(
      from,
      {
        text: `No pude agregar al usuário.\n${erro?.message || erro}`,
        ...global.channelInfo,
      },
      { quoted: msg }
    );
  }
}

async function handleGroupInfo(context) {
  const { sock, msg, from } = context;
  try {
    const metadata = await sock.groupMetadata(from);
    const total = Array.isArray(metadata?.participants) ? metadata.participants.length : 0;
    const admins = (metadata?.participants || []).filter((p) => p?.admin).length;
    const dono = cleanText(metadata?.dono || metadata?.donoPn || "");
    const description = cleanText(metadata?.desc || "Sen descrição");
    const text =
      `*INFO DEL GRUPO*\n\n` +
      `Nome: *${cleanText(metadata?.subject || "Sem nome")}*\n` +
      `ID: *${from}*\n` +
      `Membros: *${total}*\n` +
      `Admins: *${admins}*\n` +
      `Dono: *${dono ? formatShortJid(dono) : "N/D"}*\n` +
      `Descrição: ${description}`;

    return sock.sendMessage(from, { text, ...global.channelInfo }, { quoted: msg });
  } catch (erro) {
    return sock.sendMessage(
      from,
      { text: `No pude leer la info del grupo.\n${erro?.message || erro}`, ...global.channelInfo },
      { quoted: msg }
    );
  }
}

async function handleListaMember(context) {
  const { sock, msg, from } = context;
  const metadata = await sock.groupMetadata(from);
  const list = (metadata?.participants || []).map((item, index) => {
    const jid = cleanText(item?.id || item?.jid || "");
    const role = item?.admin ? (item.admin === "superadmin" ? "dono" : "admin") : "membro";
    return `${index + 1}. ${formatShortJid(jid)} (${role})`;
  });
  return sock.sendMessage(
    from,
    {
      text: `*LISTA DE MIEMBROS* (${list.length})\n\n${list.join("\n")}`,
      ...global.channelInfo,
    },
    { quoted: msg }
  );
}

async function handleBuscarMember(context) {
  const { sock, msg, from, args = [] } = context;
  const query = cleanText(args.join(" ")).toLowerCase();
  if (!query) {
    return sock.sendMessage(
      from,
      { text: "Usa: *.buscarmember texto*", ...global.channelInfo },
      { quoted: msg }
    );
  }
  const metadata = await sock.groupMetadata(from);
  const found = (metadata?.participants || []).filter((item) => {
    const jid = cleanText(item?.id || item?.jid || "").toLowerCase();
    return jid.includes(query);
  });
  const lines = found.map((item, index) => `${index + 1}. ${formatShortJid(item?.id || item?.jid || "")}`);
  return sock.sendMessage(
    from,
    {
      text: `Resultado de "${query}": *${found.length}*\n\n${lines.join("\n") || "Sen coincidencias."}`,
      ...global.channelInfo,
    },
    { quoted: msg }
  );
}

async function handleSetName(context) {
  const { sock, msg, from, args = [] } = context;
  const subject = cleanText(args.join(" "));
  if (!subject) {
    return sock.sendMessage(from, { text: "Usa: *.setname Novo Nome*", ...global.channelInfo }, { quoted: msg });
  }
  await sock.groupUpdateSubject(from, subject);
  return sock.sendMessage(from, { text: `Nome atualizado a: *${subject}*`, ...global.channelInfo }, { quoted: msg });
}

async function handleSetDesc(context) {
  const { sock, msg, from, args = [] } = context;
  const description = cleanText(args.join(" "));
  if (!description) {
    return sock.sendMessage(from, { text: "Usa: *.setdesc Nova descrição*", ...global.channelInfo }, { quoted: msg });
  }
  await sock.groupUpdateDescription(from, description);
  return sock.sendMessage(from, { text: "Descrição atualizada.", ...global.channelInfo }, { quoted: msg });
}

async function handleLinkGp(context) {
  const { sock, msg, from } = context;
  const code = await sock.groupInviteCode(from);
  const link = `https://chat.whatsapp.com/${code}`;
  return sock.sendMessage(from, { text: `*LINK DEL GRUPO*\n${link}`, ...global.channelInfo }, { quoted: msg });
}

export default {
  name: "comandosemagem",
  command: [
    "ban",
    "add",
    "mute",
    "unmute",
    "warn",
    "warnings",
    "antinvites",
    "limpar",
    "baneo",
    "desban",
    "reportes",
    "goodbye",
    "bienvenido",
    "despedido",
    "linkgp",
    "info",
    "infogp",
    "setname",
    "setdesc",
    "setfoto",
    "muteall",
    "reacciones",
    "audios",
    "autosticker",
    "modoestrico",
    "reset",
    "profile",
    "whois",
    "rank",
    "top",
    "actividad",
    "cumpleaños",
    "cumpleanos",
    "buscarmember",
    "listamember",
    "contador",
    "vips",
    "blacklist",
    "addvip",
    "delvip",
  ],
  category: "grupo",
  description: "Compatibilidad de comandos de la imagem del menu de grupos.",
  groupOnly: true,

  run: async (context) => {
    const { commandName = "", sock, from, msg, args = [], isGroup = false, sender, settings, esAdmin = false, esDono = false } = context;
    const cmd = cleanText(commandName).toLowerCase();
    const effectiveAdmin = esAdmin || esDono;

    if (!isGroup && ["profile", "whois"].includes(cmd) === false) {
      return sock.sendMessage(from, { text: "Este comando solo funçãoa en grupos.", ...global.channelInfo }, { quoted: msg });
    }

    if (cmd === "ban") {
      if (!effectiveAdmin) return sock.sendMessage(from, { text: "Solo admin.", ...global.channelInfo }, { quoted: msg });
      return runDelegated(kickCmd, context, "kick", args);
    }
    if (cmd === "add") {
      if (!effectiveAdmin) return sock.sendMessage(from, { text: "Solo admin.", ...global.channelInfo }, { quoted: msg });
      return handleAdd(context);
    }
    if (cmd === "promote") return runDelegated(promoteCmd, context, "promote", args);
    if (cmd === "demote") return runDelegated(demoteCmd, context, "demote", args);
    if (cmd === "warn") {
      if (!effectiveAdmin) return sock.sendMessage(from, { text: "Solo admin.", ...global.channelInfo }, { quoted: msg });
      return handleWarn(context);
    }
    if (cmd === "warnings") return handleWarnings(context);

    if (cmd === "antinvites") {
      if (!effectiveAdmin) return sock.sendMessage(from, { text: "Solo admin.", ...global.channelInfo }, { quoted: msg });
      const toggle = cleanText(args[0]).toLowerCase() || "status";
      if (toggle === "on" || toggle === "off") {
        return runDelegated(antilinkCmd, context, "antilink", ["tipo", "grupos", toggle]);
      }
      return runDelegated(antilinkCmd, context, "antilink", []);
    }
    if (cmd === "muteall") {
      if (!effectiveAdmin) return sock.sendMessage(from, { text: "Solo admin.", ...global.channelInfo }, { quoted: msg });
      const toggle = cleanText(args[0]).toLowerCase();
      if (toggle === "on") return runDelegated(context.comandos.get("grupo"), context, "grupo", ["fechar"]);
      if (toggle === "off") return runDelegated(context.comandos.get("grupo"), context, "grupo", ["abrir"]);
      return sock.sendMessage(from, { text: "Usa: *.muteall on/off*", ...global.channelInfo }, { quoted: msg });
    }
    if (cmd === "mute" || cmd === "unmute") {
      return sock.sendMessage(
        from,
        {
          text: "WhatsApp no permite mutear por usuário de forma nativa.\nUsa *.warn*, *.kick* o *.muteall on/off*.",
          ...global.channelInfo,
        },
        { quoted: msg }
      );
    }

    if (cmd === "goodbye") {
      if (!effectiveAdmin) return sock.sendMessage(from, { text: "Solo admin.", ...global.channelInfo }, { quoted: msg });
      return runDelegated(welcomeCmd, context, "welcome", ["bye", ...(args.length ? args : ["on"])]);
    }
    if (cmd === "bienvenido") {
      if (!effectiveAdmin) return sock.sendMessage(from, { text: "Solo admin.", ...global.channelInfo }, { quoted: msg });
      return runDelegated(welcomeCmd, context, "welcome", ["text", ...args]);
    }
    if (cmd === "despedido") {
      if (!effectiveAdmin) return sock.sendMessage(from, { text: "Solo admin.", ...global.channelInfo }, { quoted: msg });
      return runDelegated(welcomeCmd, context, "welcome", ["byetext", ...args]);
    }
    if (cmd === "setfoto") {
      if (!effectiveAdmin) return sock.sendMessage(from, { text: "Solo admin.", ...global.channelInfo }, { quoted: msg });
      return runDelegated(welcomeCmd, context, "welcome", ["image", ...args]);
    }
    if (cmd === "reacciones") {
      if (!effectiveAdmin) return sock.sendMessage(from, { text: "Solo admin.", ...global.channelInfo }, { quoted: msg });
      return sock.sendMessage(from, { text: "Comando de compatibilidad ativo. Se quieres, te implemento sestema real de reacciones por grupo.", ...global.channelInfo }, { quoted: msg });
    }
    if (cmd === "audios") {
      if (!effectiveAdmin) return sock.sendMessage(from, { text: "Solo admin.", ...global.channelInfo }, { quoted: msg });
      return sock.sendMessage(from, { text: "Comando de compatibilidad ativo. Se quieres, te implemento bloqueo real de audios por grupo.", ...global.channelInfo }, { quoted: msg });
    }
    if (cmd === "autosticker") {
      if (!effectiveAdmin) return sock.sendMessage(from, { text: "Solo admin.", ...global.channelInfo }, { quoted: msg });
      return sock.sendMessage(from, { text: "Comando de compatibilidad ativo. Puedo integrarte autosticker por grupo en el seguiente paso.", ...global.channelInfo }, { quoted: msg });
    }
    if (cmd === "modoestrico") {
      if (!effectiveAdmin) return sock.sendMessage(from, { text: "Solo admin.", ...global.channelInfo }, { quoted: msg });
      return runDelegated(modoadmiCmd, context, "modoadmi", args);
    }
    if (cmd === "reset") {
      if (!effectiveAdmin) return sock.sendMessage(from, { text: "Solo admin.", ...global.channelInfo }, { quoted: msg });
      await runDelegated(antispamCmd, context, "antispam", ["off"]);
      await runDelegated(antifloodCmd, context, "antiflood", ["off"]);
      await runDelegated(antilinkCmd, context, "antilink", ["off"]);
      await runDelegated(modoadmiCmd, context, "modoadmi", ["off"]);
      await runDelegated(welcomeCmd, context, "welcome", ["off"]);
      await runDelegated(welcomeCmd, context, "welcome", ["bye", "off"]);
      return sock.sendMessage(from, { text: "Reset aplicado: protecciones base en OFF.", ...global.channelInfo }, { quoted: msg });
    }

    if (cmd === "linkgp") return handleLinkGp(context);
    if (cmd === "info" || cmd === "infogp") return handleGroupInfo(context);
    if (cmd === "listamember") return handleListaMember(context);
    if (cmd === "contador") {
      const metadata = await sock.groupMetadata(from);
      const total = Array.isArray(metadata?.participants) ? metadata.participants.length : 0;
      return sock.sendMessage(from, { text: `Contador del grupo: *${total}* membros.`, ...global.channelInfo }, { quoted: msg });
    }
    if (cmd === "buscarmember") return handleBuscarMember(context);
    if (cmd === "setname") {
      if (!effectiveAdmin) return sock.sendMessage(from, { text: "Solo admin.", ...global.channelInfo }, { quoted: msg });
      return handleSetName(context);
    }
    if (cmd === "setdesc") {
      if (!effectiveAdmin) return sock.sendMessage(from, { text: "Solo admin.", ...global.channelInfo }, { quoted: msg });
      return handleSetDesc(context);
    }
    if (cmd === "profile") return runDelegated(perfilCmd, { ...context, isGroup: true }, "perfil", args);
    if (cmd === "whois") return runDelegated(perfilCmd, { ...context, isGroup: true }, "perfil", args);
    if (cmd === "rank") return runDelegated(nivelesCmd, context, "ranknivel", []);
    if (cmd === "nivel") return runDelegated(nivelesCmd, context, "nivel", []);
    if (cmd === "top") return runDelegated(nivelesCmd, context, "topnivel", args);
    if (cmd === "admins") return runDelegated(adminsCmd, context, "admins", []);
    if (cmd === "actividad") return runDelegated(nivelesCmd, context, "topnivel", ["10"]);
    if (cmd === "cumpleaños" || cmd === "cumpleanos") {
      return sock.sendMessage(from, { text: "Cumpleanos: funçãoalidad base creada. Se quieres, te agrego agenda real por usuário.", ...global.channelInfo }, { quoted: msg });
    }
    if (cmd === "vips") return runDelegated(vipCmd, context, "vip", ["list"]);
    if (cmd === "addvip") return runDelegated(vipCmd, context, "vip", ["add", ...args]);
    if (cmd === "delvip") return runDelegated(vipCmd, context, "vip", ["del", ...args]);
    if (cmd === "blacklist") return runDelegated(banuserCmd, context, "banlist", []);
    if (cmd === "baneo") return runDelegated(banuserCmd, context, "banlist", []);
    if (cmd === "desban") return runDelegated(banuserCmd, context, "unbanuser", args);
    if (cmd === "reportes") return runDelegated(reportCmd, context, "report", args);
    if (cmd === "limpar") {
      return sock.sendMessage(from, { text: "Limpar masevo no es compatible por API de WhatsApp Web. Usa moderacion manual o antispam.", ...global.channelInfo }, { quoted: msg });
    }

    return sock.sendMessage(from, { text: "Comando de compatibilidad no reconocido.", ...global.channelInfo }, { quoted: msg });
  },
};
