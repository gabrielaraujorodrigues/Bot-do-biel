import {
  formatCoins,
  gambleCoins,
  getPrefix,
} from "./_shared.js";

export default {
  name: "apostar",
  command: ["apostar", "bet", "apostarcoins", "apostardólares"],
  category: "economia",
  description: "Apuesta dólares para intentar ganar mas",

  run: async ({ sock, msg, from, sender, args = [], settings }) => {
    const amount = Number(args[0] || 0);
    const prefix = getPrefix(settings);

    if (!amount) {
      return sock.sendMessage(
        from,
        {
          text: `Uso: ${prefix}apostar 300`,
          ...global.channelInfo,
        },
        { quoted: msg }
      );
    }

    const result = gambleCoins(sender, amount);
    if (!result.ok) {
      return sock.sendMessage(
        from,
        {
          text: "No pude procesar tu apuesta.",
          ...global.channelInfo,
        },
        { quoted: msg }
      );
    }

    const outcomeText =
      result.outcome === "jackpot"
        ? `JACKPOT. Você ganhou *${formatCoins(result.profit)}*`
        : result.outcome === "win"
          ? `Você ganhou *${formatCoins(result.profit)}*`
          : "Perdiste la apuesta.";

    return sock.sendMessage(
      from,
      {
        text:
          `*APUESTA*\n\n` +
          `Monto: *${formatCoins(result.stake)}*\n` +
          `${outcomeText}`,
        ...global.channelInfo,
      },
      { quoted: msg }
    );
  },
};
