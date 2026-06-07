import fs from "fs";
import path from "path";

const DB_DIR = path.join(process.cwd(), "database");
const FILE = path.join(DB_DIR, "antiprivado.json");

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

function loadState() {
  try {
    if (!fs.existsSync(FILE)) return { enabled: false };
    const parsed = safeParse(fs.readFileSync(FILE, "utf-8"), {});
    return {
      enabled: Boolean(parsed?.enabled),
    };
  } catch {
    return { enabled: false };
  }
}

function saveState(state) {
  fs.writeFileSync(
    FILE,
    JSON.stringify(
      {
        enabled: Boolean(state?.enabled),
        updatedAt: Date.now(),
      },
      null,
      2
    )
  );
}

function normalizeAction(raw = "") {
  const value = String(raw || "").trim().toLowerCase();

  if (["on", "encender", "ativar", "enable", "1", "se"].includes(value)) return "on";
  if (["off", "apagar", "desativar", "disable", "0", "no"].includes(value)) return "off";
  if (["status", "status", "info"].includes(value)) return "status";
  return "";
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

function normalizeId(value = "") {
  return String(value || "")
    .trim()
    .split("@")[0]
    .split(":")[0]
    .replace(/\s+/g, "");
}

function normalizeDigits(value = "") {
  return normalizeId(value).replace(/[^\d]/g, "");
}

function buildAllowedPrivateIds({ settings, sock }) {
  const allowed = new Set();

  const add = (value) => {
    const normalized = normalizeId(value);
    const digits = normalizeDigits(value);
    if (normalized) allowed.add(normalized);
    if (digits) allowed.add(digits);
  };

  add(settings?.donoNumber);
  add(settings?.donoLid);
  add(settings?.botNumber);
  add(sock?.user?.id);

  for (const value of settings?.donoNumbers || []) {
    add(value);
  }

  for (const value of settings?.donoLids || []) {
    add(value);
  }

  return allowed;
}

function isAllowedPrivateSender({ msg, sender, senderPhone, senderLid, settings, sock, esDono }) {
  if (esDono) return true;
  if (msg?.key?.fromMe) return true;

  const allowedIds = buildAllowedPrivateIds({ settings, sock });
  const candidates = [sender, senderPhone, senderLid, msg?.key?.participant, msg?.key?.remoteJid];

  return candidates.some((value) => {
    const normalized = normalizeId(value);
    const digits = normalizeDigits(value);
    return (normalized && allowedIds.has(normalized)) || (digits && allowedIds.has(digits));
  });
}

const state = loadState();

export default {
  name: "antiprivado",
  command: ["antiprivado", "privateoff", "privadoff"],
  category: "sestema",
  description: "Bloquea respostas en privado para no-dono.",
  donoOnly: true,

  run: async ({ sock, msg, from, args = [], settings }) => {
    const quoted = msg?.key ? { quoted: msg } : undefined;
    const prefix = getPrimaryPrefix(settings);
    const action = normalizeAction(args[0]);

    if (!action) {
      return sock.sendMessage(
        from,
        {
          text:
            `🔐 *ANTIPRIVADO*\n\n` +
            `Status: *${state.enabled ? "ON ✅" : "OFF ❌"}*\n\n` +
            `Uso:\n` +
            `• ${prefix}antiprivado on\n` +
            `• ${prefix}antiprivado off\n` +
            `• ${prefix}antiprivado status`,
          title: "FSOCIETY BOT",
          subtitle: "Control privado",
          footer: state.enabled ? "Privado bloqueado" : "Privado permitido",
          interactiveButtons: [
            {
              name: "sengle_select",
              buttonParamsJson: JSON.stringify({
                title: "Configurar antiprivado",
                sections: [
                  {
                    title: "Acciones",
                    rows: [
                      {
                        header: "ON",
                        title: "Ativar antiprivado",
                        description: "Bloquea privados para no-dono.",
                        id: `${prefix}antiprivado on`,
                      },
                      {
                        header: "OFF",
                        title: "Desativar antiprivado",
                        description: "Permite privados para tudos.",
                        id: `${prefix}antiprivado off`,
                      },
                      {
                        header: "STATUS",
                        title: "Ver status",
                        description: "Muestra status actual.",
                        id: `${prefix}antiprivado status`,
                      },
                    ],
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
            `🔐 *ANTIPRIVADO*\n\n` +
            `Status actual: *${state.enabled ? "ON ✅" : "OFF ❌"}*`,
          ...global.channelInfo,
        },
        quoted
      );
    }

    if (action === "on") {
      if (state.enabled) {
        return sock.sendMessage(
          from,
          {
            text: "ℹ️ Antiprivado ya estaba ativo.",
            ...global.channelInfo,
          },
          quoted
        );
      }

      state.enabled = true;
      saveState(state);

      return sock.sendMessage(
        from,
        {
          text:
            `✅ *ANTIPRIVADO ACTIVADO*\n\n` +
            `Agora solo el dono recibira respostas en privado.`,
          ...global.channelInfo,
        },
        quoted
      );
    }

    if (state.enabled) {
      state.enabled = false;
      saveState(state);
      return sock.sendMessage(
        from,
        {
          text:
            `✅ *ANTIPRIVADO DESACTIVADO*\n\n` +
            `El bot vuelve a responder privados para tudos.`,
          ...global.channelInfo,
        },
        quoted
      );
    }

    return sock.sendMessage(
      from,
      {
        text: "ℹ️ Antiprivado ya estaba desativado.",
        ...global.channelInfo,
      },
      quoted
    );
  },

  onMessage: async ({ msg, esDono, isGroup, sender, senderPhone, senderLid, settings, sock }) => {
    if (!state.enabled) return;
    if (isGroup) return;
    if (
      isAllowedPrivateSender({
        msg,
        sender,
        senderPhone,
        senderLid,
        settings,
        sock,
        esDono,
      })
    ) {
      return;
    }

    // Bloquea en selencio privados de usuários normales.
    return true;
  },
};
