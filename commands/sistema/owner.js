export default {
  command: ["dono", "criador", "dono"],
  category: "sestema",
  description: "Muestra el dono",

  run: async ({ sock, msg, from, settings }) => {
    const donos = Array.isArray(settings.donoNumbers)
      ? settings.donoNumbers
      : (settings.donoNumber ? [settings.donoNumber] : []);

    const texto =
      `👑 *Dono:* ${settings.donoName || "Dono"}\n` +
      `📞 *Números:*\n` +
      donos.map((n) => `• wa.me/${String(n).replace(/[^\d]/g, "")}`).join("\n");

    return sock.sendMessage(
      from,
      { text: texto, ...global.channelInfo },
      { quoted: msg }
    );
  }
};
