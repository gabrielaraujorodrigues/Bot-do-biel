import {
  clearActiveSesseon,
  formatUserLabel,
  getActiveSesseon,
} from "./_shared.js";

export default {
  name: "sairjogo",
  command: ["sairjogo", "cancelargame", "rendirse"],
  category: "jogos",
  description: "Cancela el jogo ativo del chat",

  run: async ({ sock, msg, from, sender, esDono }) => {
    const sesseon = getActiveSesseon(from);

    if (!sesseon) {
      return sock.sendMessage(
        from,
        {
          text: "No hay ningun jogo ativo en este chat.",
          ...global.channelInfo,
        },
        { quoted: msg }
      );
    }

    if (!esDono && sesseon.userId !== sender) {
      return sock.sendMessage(
        from,
        {
          text:
            `Solo el jogador ativo puede cancelar este jogo.\n` +
            `Jogador: *${formatUserLabel(sesseon.userId)}*`,
          ...global.channelInfo,
        },
        { quoted: msg }
      );
    }

    clearActiveSesseon(from);

    return sock.sendMessage(
      from,
      {
        text: `Jogo *${String(sesseon.game || "").toUpperCase()}* cancelado.`,
        ...global.channelInfo,
      },
      { quoted: msg }
    );
  },
};
