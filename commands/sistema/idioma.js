import { getPrimaryPrefix } from "../../lib/json-store.js";
import {
  getChatLanguage,
  setChatLanguage,
  listSupportedChatLanguages,
} from "../../lib/chat-language.js";

export default {
  name: "idioma",
  command: ["idioma", "language", "lang"],
  category: "ferramentas",
  description: "Configura el idioma por chat o grupo",

  run: async ({ sock, msg, from, args = [], settings, esDono, esAdmin, isGroup }) => {
    if (isGroup && !esDono && !esAdmin) {
      return sock.sendMessage(from, { text: "Somente admins u dono pueden cambiar el idioma del grupo.", ...global.channelInfo }, { quoted: msg });
    }

    const prefix = getPrimaryPrefix(settings);
    const SUPPORTED = listSupportedChatLanguages();
    const current = getChatLanguage(from, "es");
    const next = String(args[0] || "").trim().toLowerCase();

    if (!next) {
      return sock.sendMessage(
        from,
        {
          text:
            `*IDIOMA DEL CHAT*\n\n` +
            `Actual: *${SUPPORTED[current] || "Espanol"}*\n\n` +
            `Disponíveis: ${Object.keys(SUPPORTED).join(", ")}\n` +
            `Uso: ${prefix}idioma es`,
          ...global.channelInfo,
        },
        { quoted: msg }
      );
    }

    if (!SUPPORTED[next]) {
      return sock.sendMessage(from, { text: "Idiomas disponíveis: es, en, pt", ...global.channelInfo }, { quoted: msg });
    }

    setChatLanguage(from, next);
    return sock.sendMessage(from, { text: `Idioma atualizado a *${SUPPORTED[next]}*`, ...global.channelInfo }, { quoted: msg });
  },
};
