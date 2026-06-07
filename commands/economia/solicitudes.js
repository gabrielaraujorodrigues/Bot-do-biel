import {
  formatCoins,
  getDownloadRequestState,
  getEconomyConfig,
  getPrefix,
} from "./_shared.js";

export default {
  name: "solicitações",
  command: ["solicitações", "requests", "reqs", "misdownloads", "req", "misreq"],
  category: "economia",
  description: "Muestra tus solicitações de downloads y el costo actual",

  run: async ({ sock, msg, from, sender, settings, esDono }) => {
    const requests = getDownloadRequestState(sender, settings);
    const config = getEconomyConfig(settings);
    const prefix = getPrefix(settings);

    await sock.sendMessage(
      from,
      {
        text:
          `*SOLICITUDES DE DESCARGA*\n\n` +
          `Modo cobro: *${esDono ? "ISENTO DONO" : config.downloadBillingEnabled ? "ACTIVO" : "APAGADO"}*\n` +
          `Grátis por dia: *${requests?.dailyLimit || 0}*\n` +
          `Disponíveis hoy: *${requests?.dailyRemaining || 0}*\n` +
          `Extra compradas: *${requests?.extraRemaining || 0}*\n` +
          `Usadas total: *${requests?.totalConsumed || 0}*\n` +
          `Precio por solicitação: *${formatCoins(requests?.requestPrice || config.requestPrice)}*\n\n` +
          `Compra mas con: *${prefix}buyrequests 5*`,
        ...global.channelInfo,
      },
      { quoted: msg }
    );
  },
};
