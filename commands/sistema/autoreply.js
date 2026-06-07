import path from "path";
import { createScheduledJsonStore, getPrimaryPrefix } from "../../lib/json-store.js";

const FILE = path.join(process.cwd(), "database", "autoreplies.json");
const store = createScheduledJsonStore(FILE, () => ({
  chats: {},
}));

function ensureChat(chatId) {
  const key = String(chatId || "").trim();
  if (!key) return null;
  if (!store.state.chats[key]) {
    store.state.chats[key] = {
      enabled: false,
      items: [],
    };
  }
  return store.state.chats[key];
}

export default {
  name: "autoreply",
  command: ["autoreply", "faq", "respostaauto"],
  category: "sestema",
  description: "Respostas automaticas por grupo o chat",

  run: async ({ sock, msg, from, args = [], settings, esDono, esAdmin, isGroup }) => {
    if (isGroup && !esDono && !esAdmin) {
      return sock.sendMessage(from, { text: "Somente admins u dono pueden configurarlo en grupos.", ...global.channelInfo }, { quoted: msg });
    }

    const prefix = getPrimaryPrefix(settings);
    const action = String(args[0] || "status").trim().toLowerCase();
    const chat = ensureChat(from);

    if (action === "on" || action === "off") {
      chat.enabled = action === "on";
      store.scheduleSave();
      return sock.sendMessage(from, { text: `Autoreply: *${chat.enabled ? "ENCENDIDO" : "APAGADO"}*`, ...global.channelInfo }, { quoted: msg });
    }

    if (action === "add") {
      const raw = String(args.slice(1).join(" ") || "");
      const [trigger, response] = raw.split("|").map((part) => String(part || "").trim());
      if (!trigger || !response) {
        return sock.sendMessage(from, { text: `Uso: ${prefix}autoreply add olá | Olá, en que te ayudo?`, ...global.channelInfo }, { quoted: msg });
      }

      chat.items = chat.items.filter((item) => item.trigger !== trigger.toLowerCase());
      chat.items.push({
        trigger: trigger.toLowerCase(),
        response: response.slice(0, 500),
      });
      store.scheduleSave();
      return sock.sendMessage(from, { text: `Autoreply salvo para: *${trigger}*`, ...global.channelInfo }, { quoted: msg });
    }

    if (action === "del" || action === "remove") {
      const trigger = String(args.slice(1).join(" ") || "").trim().toLowerCase();
      chat.items = chat.items.filter((item) => item.trigger !== trigger);
      store.scheduleSave();
      return sock.sendMessage(from, { text: `Autoreply removido: *${trigger || "sen clave"}*`, ...global.channelInfo }, { quoted: msg });
    }

    if (action === "list") {
      return sock.sendMessage(
        from,
        {
          text:
            `*AUTOREPLY*\n\n` +
            `Status: *${chat.enabled ? "ENCENDIDO" : "APAGADO"}*\n` +
            `Items: *${chat.items.length}*\n\n` +
            (chat.items.length
              ? chat.items.map((item) => `• ${item.trigger} -> ${item.response}`).join("\n")
              : "No hay respostas guardadas."),
          ...global.channelInfo,
        },
        { quoted: msg }
      );
    }

    return sock.sendMessage(
      from,
      {
        text:
          `*AUTOREPLY*\n\n` +
          `${prefix}autoreply on\n` +
          `${prefix}autoreply off\n` +
          `${prefix}autoreply add olá | Olá, en que te ayudo?\n` +
          `${prefix}autoreply del olá\n` +
          `${prefix}autoreply list`,
        ...global.channelInfo,
      },
      { quoted: msg }
    );
  },

  onMessage: async ({ sock, msg, from, text }) => {
    const chat = ensureChat(from);
    if (!chat?.enabled) return false;

    const body = String(text || "").trim().toLowerCase();
    if (!body || body.startsWith(".") || body.startsWith("/") || body.startsWith("!") || body.startsWith("#")) {
      return false;
    }

    const match = chat.items.find((item) => body.includes(item.trigger));
    if (!match) return false;

    await sock.sendMessage(
      from,
      {
        text: match.response,
        ...global.channelInfo,
      },
      { quoted: msg }
    );

    return true;
  },
};
