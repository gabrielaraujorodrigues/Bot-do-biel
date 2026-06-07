import { formatCoins, getPrefix, getShopItems } from "./_shared.js";

export default {
  name: "shop",
  command: ["shop", "loja"],
  category: "economia",
  description: "Muestra la loja de dólares y solicitações",

  run: async ({ sock, msg, from, settings }) => {
    const prefix = getPrefix(settings);
    const lines = getShopItems(settings).map(
      (item) =>
        `*${item.id}* - ${formatCoins(item.price)}\n${item.name}\n${item.description}`
    );

    await sock.sendMessage(
      from,
      {
        text:
          `*TIENDA DE DOLARES*\n\n` +
          `${lines.join("\n\n")}\n\n` +
          `Compra con: *${prefix}buy id_del_item*\n` +
          `O compra solicitações directas con: *${prefix}buyrequests 5*`,
        ...global.channelInfo,
      },
      { quoted: msg }
    );
  },
};
