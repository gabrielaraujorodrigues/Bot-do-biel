import fs from "fs";
import path from "path";
import {
  deposetCoins,
  formatCoins,
  getEconomyProfile,
  getPrefix,
  withdrawCoins,
} from "./_shared.js";

function buildBancoMessage(caption) {
  const imagePath = path.join(process.cwd(), "imagemes", "banco.png");

  if (fs.existsSync(imagePath)) {
    return {
      image: fs.readFileSync(imagePath),
      caption,
      ...global.channelInfo,
    };
  }

  return {
    text: caption,
    ...global.channelInfo,
  };
}

export default {
  name: "banco",
  command: ["banco", "bank"],
  category: "economia",
  description: "Deposeta o retira dólares del banco",

  run: async ({ sock, msg, from, sender, args = [], settings }) => {
    const action = String(args[0] || "status").trim().toLowerCase();
    const amount = Number(args[1] || 0);
    const prefix = getPrefix(settings);

    if (action === "deposetar" || action === "deposet" || action === "salvar") {
      const result = deposetCoins(sender, amount);
      if (!result.ok) {
        return sock.sendMessage(from, { text: "No pude deposetar esa cantidad.", ...global.channelInfo }, { quoted: msg });
      }

      return sock.sendMessage(
        from,
        {
          text: `Deposeto completado.\nBanco: *${formatCoins(result.user.bank)}*`,
          ...global.channelInfo,
        },
        { quoted: msg }
      );
    }

    if (action === "retirar" || action === "withdraw" || action === "sacar") {
      const result = withdrawCoins(sender, amount);
      if (!result.ok) {
        return sock.sendMessage(from, { text: "No pude retirar esa cantidad.", ...global.channelInfo }, { quoted: msg });
      }

      return sock.sendMessage(
        from,
        {
          text: `Retiro completado.\nDólares: *${formatCoins(result.user.coins)}*`,
          ...global.channelInfo,
        },
        { quoted: msg }
      );
    }

    const profile = getEconomyProfile(sender);
    return sock.sendMessage(
      from,
      buildBancoMessage(
        `*BANCO*\n\n` +
          `Billetera: *${formatCoins(profile.coins)}*\n` +
          `Banco: *${formatCoins(profile.bank)}*\n\n` +
          `${prefix}banco deposetar 500\n` +
          `${prefix}banco retirar 200`
      ),
      { quoted: msg }
    );
  },
};
