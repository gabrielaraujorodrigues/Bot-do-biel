import path from "path";
import { createScheduledJsonStore, getPrimaryPrefix } from "../../lib/json-store.js";

const FILE = path.join(process.cwd(), "database", "group-rules.json");
const store = createScheduledJsonStore(FILE, () => ({
  groups: {},
}));

export default {
  name: "regras",
  command: ["regras", "rules"],
  category: "grupo",
  description: "Guarda y muestra regras del grupo",
  groupOnly: true,

  run: async ({ sock, msg, from, args = [], settings, esDono, esAdmin }) => {
    const prefix = getPrimaryPrefix(settings);
    const action = String(args[0] || "").trim().toLowerCase();
    const current = String(store.state.groups[from] || "").trim();

    if (!action) {
      return sock.sendMessage(
        from,
        {
          text:
            current ||
            `No hay regras guardadas.\n\nUso:\n${prefix}regras set Nada de spam\n${prefix}regras off`,
          ...global.channelInfo,
        },
        { quoted: msg }
      );
    }

    if (!esDono && !esAdmin) {
      return sock.sendMessage(from, { text: "Somente admins u dono pueden cambiar las regras.", ...global.channelInfo }, { quoted: msg });
    }

    if (action === "off" || action === "reset") {
      delete store.state.groups[from];
      store.scheduleSave();
      return sock.sendMessage(from, { text: "Regras borradas.", ...global.channelInfo }, { quoted: msg });
    }

    if (action === "set") {
      const rules = String(args.slice(1).join(" ") || "").trim();
      if (!rules) {
        return sock.sendMessage(from, { text: `Uso: ${prefix}regras set texto`, ...global.channelInfo }, { quoted: msg });
      }

      store.state.groups[from] = rules.slice(0, 1000);
      store.scheduleSave();
      return sock.sendMessage(from, { text: "Regras atualizadas.", ...global.channelInfo }, { quoted: msg });
    }

    return sock.sendMessage(from, { text: current || "No hay regras guardadas.", ...global.channelInfo }, { quoted: msg });
  },
};
