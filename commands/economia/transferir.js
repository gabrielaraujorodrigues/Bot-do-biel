import {
  formatCoins,
  formatUserLabel,
  getPrefix,
  transferCoins,
} from "./_shared.js";

function normalizeTarget(value = "") {
  const digits = String(value || "").replace(/[^\d]/g, "");
  return digits ? `${digits}@s.whatsapp.net` : "";
}

export default {
  name: "transferir",
  command: ["transferir", "pay", "givecoins", "transferirdólares"],
  category: "economia",
  description: "Transfiere dólares a otro usuário",

  run: async ({ sock, msg, from, sender, args = [], settings }) => {
    const target = normalizeTarget(args[0]);
    const amount = Number(args[1] || 0);
    const prefix = getPrefix(settings);

    if (!target || !amount) {
      return sock.sendMessage(
        from,
        {
          text: `Uso: ${prefix}transferir 519xxxxxxxx 300`,
          ...global.channelInfo,
        },
        { quoted: msg }
      );
    }

    const result = transferCoins(sender, target, amount);
    if (!result.ok) {
      return sock.sendMessage(
        from,
        {
          text: "No pude completar la transferencia.",
          ...global.channelInfo,
        },
        { quoted: msg }
      );
    }

    return sock.sendMessage(
      from,
      {
        text:
          `Transferencia completada.\n` +
          `Destino: *${formatUserLabel(target)}*\n` +
          `Monto: *${formatCoins(amount)}*`,
        ...global.channelInfo,
      },
      { quoted: msg }
    );
  },
};
