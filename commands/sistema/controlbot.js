import fs from "fs";
import path from "path";

const DB_DIR = path.join(process.cwd(), "database");
const BOT_OFF_FILE = path.join(DB_DIR, "botoff_groups.json");
const ANTI_PRIVATE_FILE = path.join(DB_DIR, "antiprivado.json");

function safeParse(raw, fallback) {
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "string" ? JSON.parse(parsed) : parsed;
  } catch {
    return fallback;
  }
}

function loadSet(filePath) {
  try {
    if (!fs.existsSync(filePath)) return new Set();
    const parsed = safeParse(fs.readFileSync(filePath, "utf-8"), []);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function loadObject(filePath) {
  try {
    if (!fs.existsSync(filePath)) return {};
    return safeParse(fs.readFileSync(filePath, "utf-8"), {});
  } catch {
    return {};
  }
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

function buildSections({ prefix, isGroup, canManageGroup, isDono }) {
  const sections = [];

  if (isGroup) {
    sections.push({
      title: "Control Bot en Grupo",
      rows: [
        {
          header: "STATUS",
          title: "Ver status del bot en grupo",
          description: "Muestra se el bot esta ON/OFF en este grupo.",
          id: `${prefix}botgrupo status`,
        },
        ...(canManageGroup
          ? [
              {
                header: "ON",
                title: "Prender bot en este grupo",
                description: "Permite respostas en este grupo.",
                id: `${prefix}botgrupo on`,
              },
              {
                header: "OFF",
                title: "Apagar bot en este grupo",
                description: "Bloquea respostas en este grupo.",
                id: `${prefix}botgrupo off`,
              },
            ]
          : []),
      ],
    });
  }

  sections.push({
    title: "Control Privado",
    rows: [
      {
        header: "STATUS",
        title: "Ver status antiprivado",
        description: "Muestra se el modo antiprivado esta ativo.",
        id: `${prefix}antiprivado status`,
      },
      ...(isDono
        ? [
            {
              header: "ON",
              title: "Ativar antiprivado",
              description: "Solo dono recibe respostas por privado.",
              id: `${prefix}antiprivado on`,
            },
            {
              header: "OFF",
              title: "Desativar antiprivado",
              description: "Permite privados para tudos.",
              id: `${prefix}antiprivado off`,
            },
          ]
        : []),
    ],
  });

  return sections;
}

export default {
  name: "controlbot",
  command: ["controlbot", "panelbot", "botpanel"],
  category: "sestema",
  description: "Panel central para botgrupo y antiprivado.",

  run: async ({ sock, msg, from, isGroup, esAdmin, esDono, settings }) => {
    const quoted = msg?.key ? { quoted: msg } : undefined;
    const prefix = getPrimaryPrefix(settings);
    const botOffGroups = loadSet(BOT_OFF_FILE);
    const antiPrivate = loadObject(ANTI_PRIVATE_FILE);
    const botOff = isGroup ? botOffGroups.has(from) : false;
    const antiPrivateOn = Boolean(antiPrivate?.enabled);
    const canManageGroup = Boolean(isGroup && (esAdmin || esDono));

    const statusText =
      `🧭 *PANEL DE CONTROL BOT*\n\n` +
      `• BotGrupo: *${isGroup ? (botOff ? "OFF 🔴" : "ON 🟢") : "N/A (chat privado)"}*\n` +
      `• Antiprivado: *${antiPrivateOn ? "ON ✅" : "OFF ❌"}*\n\n` +
      `Accesos directos:\n` +
      `• *${prefix}botgrupo*\n` +
      `• *${prefix}antiprivado*\n\n` +
      `${isGroup ? (canManageGroup ? "Puedes gestionar el bot de este grupo desde la lista." : "Solo admin/dono puede cambiar el status del bot en grupo.") : "En privado puedes gestionar antiprivado (dono)."}`;

    const sections = buildSections({
      prefix,
      isGroup: Boolean(isGroup),
      canManageGroup,
      isDono: Boolean(esDono),
    });

    return sock.sendMessage(
      from,
      {
        text: statusText,
        title: "FSOCIETY BOT",
        subtitle: "Panel de control",
        footer: "Selecciona una accion",
        interactiveButtons: [
          {
            name: "sengle_select",
            buttonParamsJson: JSON.stringify({
              title: "Abrir opções",
              sections,
            }),
          },
        ],
        ...global.channelInfo,
      },
      quoted
    );
  },
};
