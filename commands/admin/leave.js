import { getQuoted } from "./_shared.js";

export default {
  name: "leave",
  command: ["sair", "sairgrupo"],
  category: "admin",
  description: "Hace que el bot salga del grupo actual",
  groupOnly: true,

  run: async ({ sock, msg, from, esDono, botLabel }) => {
    if (!esDono) {
      return sock.sendMessage(
        from,
        {
          text: "Apenas o dono pode usar este comando.",
          ...global.channelInfo,
        },
        getQuoted(msg)
      );
    }

    await sock.sendMessage(
      from,
      {
        text: `${String(botLabel || "BOT").toUpperCase()} saldra de este grupo en unos segundos.`,
        ...global.channelInfo,
      },
      getQuoted(msg)
    );

    await new Promise((resolve) => setTimeout(resolve, 1200));
    await sock.groupLeave(from);
  },
};
