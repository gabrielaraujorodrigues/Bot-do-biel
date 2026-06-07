import fs from "fs";
import path from "path";

const DB_DIR = path.join(process.cwd(), "database");

const FILES = {
  antilink: path.join(DB_DIR, "antilink.json"),
  antispam: path.join(DB_DIR, "antispam.json"),
  botoff: path.join(DB_DIR, "botoff_groups.json"),
  welcome: path.join(DB_DIR, "welcome.json"),
  modoadmi: path.join(DB_DIR, "modoadmi.json"),
  antiflood: path.join(DB_DIR, "antiflood.json"),
};

function safeParse(raw, fallback) {
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "string" ? JSON.parse(parsed) : parsed;
  } catch {
    return fallback;
  }
}

function loadAny(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return safeParse(fs.readFileSync(filePath, "utf-8"), fallback);
  } catch {
    return fallback;
  }
}

function getPrefix(settings) {
  if (Array.isArray(settings?.prefix)) {
    return settings.prefix.find((value) => String(value || "").trim()) || ".";
  }
  return String(settings?.prefix || ".").trim() || ".";
}

function readSetFlag(filePath, groupId) {
  const data = loadAny(filePath, []);
  if (Array.isArray(data)) return data.includes(groupId);
  if (data && typeof data === "object") {
    const entry = data[groupId];
    if (typeof entry === "boolean") return entry;
    if (entry && typeof entry === "object") return entry.enabled === true;
  }
  return false;
}

function readWelcomeFlags(groupId) {
  const data = loadAny(FILES.welcome, {});
  const entry = data && typeof data === "object" ? data[groupId] : null;
  if (!entry) {
    return { welcomeOn: false, byeOn: false };
  }
  if (typeof entry === "boolean") {
    return { welcomeOn: entry, byeOn: false };
  }
  return {
    welcomeOn: entry.enabled === true || entry.welcomeEnabled === true,
    byeOn: entry.byeEnabled === true || entry.goodbyeEnabled === true,
  };
}

function readAntifloodFlag(groupId) {
  const data = loadAny(FILES.antiflood, {});
  if (!data || typeof data !== "object") return false;
  const group = data.groups && typeof data.groups === "object" ? data.groups[groupId] : null;
  return Boolean(group?.enabled);
}

function readAntiLinkFlag(groupId) {
  const data = loadAny(FILES.antilink, {});
  if (Array.isArray(data)) return data.includes(groupId);
  if (!data || typeof data !== "object") return false;
  const entry = data[groupId];
  if (typeof entry === "boolean") return entry;
  if (!entry || typeof entry !== "object") return false;
  return entry.enabled === true;
}

function badge(value) {
  return value ? "ON ✅" : "OFF ❌";
}

export default {
  name: "panelgrupo",
  command: ["panelgrupo", "paneladmin", "gpanel", "adminpanel"],
  category: "grupo",
  description: "Panel admin unico del grupo con botones de control.",
  groupOnly: true,
  adminOnly: true,

  run: async ({ sock, msg, from, settings }) => {
    const prefix = getPrefix(settings);

    const antilinkOn = readAntiLinkFlag(from);
    const antispamOn = readSetFlag(FILES.antispam, from);
    const botOffOn = readSetFlag(FILES.botoff, from);
    const modeAdmiOn = readSetFlag(FILES.modoadmi, from);
    const antifloodOn = readAntifloodFlag(from);
    const welcome = readWelcomeFlags(from);

    const panelText =
      `╭──〔 🛠️ *GPANEL ADMIN* 〕──⬣\n` +
      `│ AntiLink: *${badge(antilinkOn)}*\n` +
      `│ AntiSpam: *${badge(antispamOn)}*\n` +
      `│ BotGrupo: *${botOffOn ? "OFF 🔴" : "ON 🟢"}*\n` +
      `│ Welcome: *${badge(welcome.welcomeOn)}*\n` +
      `│ Bye: *${badge(welcome.byeOn)}*\n` +
      `│ ModoAdmin: *${badge(modeAdmiOn)}*\n` +
      `│ AntiFlood: *${badge(antifloodOn)}*\n` +
      `╰────────────⬣\n\n` +
      `Toca una opção del panel para cambiar status rápido.`;

    const sections = [
      {
        title: "Seguridad",
        rows: [
          {
            header: "ANTILINK",
            title: antilinkOn ? "Apagar AntiLink" : "Prender AntiLink",
            description: `Status actual: ${badge(antilinkOn)}`,
            id: `${prefix}antilink ${antilinkOn ? "off" : "on"}`,
          },
          {
            header: "ANTISPAM",
            title: antispamOn ? "Apagar AntiSpam" : "Prender AntiSpam",
            description: `Status actual: ${badge(antispamOn)}`,
            id: `${prefix}antispam ${antispamOn ? "off" : "on"}`,
          },
          {
            header: "ANTIFLOOD",
            title: antifloodOn ? "Apagar AntiFlood" : "Prender AntiFlood",
            description: `Status actual: ${badge(antifloodOn)}`,
            id: `${prefix}antiflood ${antifloodOn ? "off" : "on"}`,
          },
        ],
      },
      {
        title: "Control de bot",
        rows: [
          {
            header: "BOTGRUPO",
            title: botOffOn ? "Prender bot en grupo" : "Apagar bot en grupo",
            description: `Status actual: ${botOffOn ? "OFF 🔴" : "ON 🟢"}`,
            id: `${prefix}botgrupo ${botOffOn ? "on" : "off"}`,
          },
          {
            header: "MODOADMIN",
            title: modeAdmiOn ? "Apagar modo admin" : "Prender modo admin",
            description: `Status actual: ${badge(modeAdmiOn)}`,
            id: `${prefix}modoadmi ${modeAdmiOn ? "off" : "on"}`,
          },
          {
            header: "STATUS",
            title: "Ver status completo del grupo",
            description: "Abre panel de configuração del grupo.",
            id: `${prefix}statusgrupo`,
          },
        ],
      },
      {
        title: "Boas-vindas y salida",
        rows: [
          {
            header: "WELCOME",
            title: welcome.welcomeOn ? "Apagar boas-vindas" : "Prender boas-vindas",
            description: `Status actual: ${badge(welcome.welcomeOn)}`,
            id: `${prefix}welcome ${welcome.welcomeOn ? "off" : "on"}`,
          },
          {
            header: "DESPEDIDA",
            title: welcome.byeOn ? "Apagar despedida" : "Prender despedida",
            description: `Status actual: ${badge(welcome.byeOn)}`,
            id: `${prefix}welcome bye ${welcome.byeOn ? "off" : "on"}`,
          },
          {
            header: "PANEL WELCOME",
            title: "Abrir ajustes boas-vindas/despedida",
            description: "Edita textos, regras e imagem.",
            id: `${prefix}welcome`,
          },
        ],
      },
    ];

    return sock.sendMessage(
      from,
      {
        text: panelText,
        title: "FSOCIETY BOT",
        subtitle: "Panel de administracion del grupo",
        footer: "Selecciona una accion",
        interactiveButtons: [
          {
            name: "sengle_select",
            buttonParamsJson: JSON.stringify({
              title: "Abrir panel de grupo",
              sections,
            }),
          },
        ],
        ...global.channelInfo,
      },
      { quoted: msg }
    );
  },
};
