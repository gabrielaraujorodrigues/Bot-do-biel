import {
  formatCoins,
  formatUserLabel,
  formatUserPhone,
  getDownloadRequestState,
  getEconomyConfig,
  getEconomyProfile,
} from "./_shared.js";

export default {
  name: "dólares",
  command: ["dólares", "saldo", "usd", "dinero", "coins", "balance", "wallet", "cartera", "misdólares"],
  category: "economia",
  description: "Mostra seus dólares, solicitações e inventário",

  run: async ({ sock, msg, from, sender, settings, esDono }) => {
    const profile = getEconomyProfile(sender, settings);
    const requests = getDownloadRequestState(sender, settings);
    const config = getEconomyConfig(settings);
    const inventoryLines = Object.entries(profile?.inventory || {})
      .filter(([, count]) => Number(count || 0) > 0)
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
      .map(([itemId, count]) => `- ${itemId}: ${count}`);

    await sock.sendMessage(
      from,
      {
        text:
          `*ECONOMIA DE ${formatUserLabel(sender)}*\n\n` +
          `Nome: *${profile?.lastKnownName || "Sem nome"}*\n` +
          `Número: *${formatUserPhone(sender) || "Sem número visível"}*\n` +
          `Dólares: *${formatCoins(profile?.coins || 0)}*\n` +
          `Banco: *${formatCoins(profile?.bank || 0)}*\n` +
          `Total atual: *${formatCoins(Number(profile?.coins || 0) + Number(profile?.bank || 0))}*\n` +
          `Total ganho: *${formatCoins(profile?.totalEarned || 0)}*\n` +
          `Total gasto: *${formatCoins(profile?.totalSpent || 0)}*\n\n` +
          `Solicitações hoje: *${requests?.dailyRemaining || 0}/${requests?.dailyLimit || 0}*\n` +
          `Solicitações extras: *${requests?.extraRemaining || 0}*\n` +
          `Solicitações usadas: *${requests?.totalConsumed || 0}*\n` +
          `Cobrança de downloads: *${esDono ? "ISENTO DONO" : config.downloadBillingEnabled ? "ACTIVO" : "APAGADO"}*\n\n` +
          `Inventário:\n${inventoryLines.length ? inventoryLines.join("\n") : "- Vacio"}`,
        ...global.channelInfo,
      },
      { quoted: msg }
    );
  },
};
