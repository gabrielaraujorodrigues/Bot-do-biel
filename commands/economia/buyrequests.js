import {
  buyDownloadRequests,
  formatCoins,
  getPrefix,
} from "./_shared.js";

export default {
  name: "buyrequests",
  command: ["buyrequests", "comprarsolicitações", "buyreq", "comprarreq", "comprarsol", "buysol"],
  category: "economia",
  description: "Compra solicitações extra de download con tus dólares",

  run: async ({ sock, msg, from, sender, args = [], settings }) => {
    const amount = Math.max(0, Math.floor(Number(args[0] || 0)));
    const prefix = getPrefix(settings);

    if (!amount) {
      return sock.sendMessage(
        from,
        {
          text: `Uso: *${prefix}buyrequests 5*`,
          ...global.channelInfo,
        },
        { quoted: msg }
      );
    }

    const result = buyDownloadRequests(sender, amount, settings);
    if (!result.ok) {
      let text = "No pude completar la compra.";

      if (result.status === "invalid_amount") {
        text = `Usa una cantidad valida. Ejemplo: *${prefix}buyrequests 5*`;
      } else if (result.status === "insufficient") {
        text =
          `No te alcanza.\n` +
          `Te faltan *${formatCoins(result.misseng || 0)}*.\n` +
          `Cada solicitação cuesta *${formatCoins(result.requestPrice || 0)}*.`;
      }

      return sock.sendMessage(
        from,
        {
          text,
          ...global.channelInfo,
        },
        { quoted: msg }
      );
    }

    await sock.sendMessage(
      from,
      {
        text:
          `*COMPRA DE SOLICITUDES*\n\n` +
          `Solicitações extras: *+${result.amount}*\n` +
          `Costo total: *${formatCoins(result.totalCost)}*\n` +
          `Saldo actual: *${formatCoins(result.user?.coins || 0)}*\n` +
          `Solicitações disponíveis: *${result.requests?.available || 0}*`,
        ...global.channelInfo,
      },
      { quoted: msg }
    );
  },
};
