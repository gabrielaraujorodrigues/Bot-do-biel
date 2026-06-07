import { claimDaily, formatCoins, getPrefix } from "./_shared.js";
import { formatDuration } from "../sestema/_shared.js";

export default {
  name: "daily",
  command: ["daily", "dailydólares", "reclamardólares", "reclamarcoins", "diário"],
  category: "economia",
  description: "Resgata sua recompensa diária em dólares",

  run: async ({ sock, msg, from, sender, settings }) => {
    const result = claimDaily(sender);
    const prefix = getPrefix(settings);

    if (!result.ok) {
      return sock.sendMessage(
        from,
      {
        text:
          `*DAILY EM ESPERA*\n\n` +
          `Você poderá resgatar novamente em *${formatDuration(result.remainingMs)}*.\n` +
          `Enquanto isso, veja seu saldo com *${prefix}dólares*.`,
        ...global.channelInfo,
      },
        { quoted: msg }
      );
    }

    await sock.sendMessage(
      from,
      {
        text:
          `*DAILY RESGATADO*\n\n` +
          `Você ganhou *${formatCoins(result.amount)}*.\n` +
          `Usa *${prefix}shop* para ver a loja.`,
        ...global.channelInfo,
      },
      { quoted: msg }
    );
  },
};
