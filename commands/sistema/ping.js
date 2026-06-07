function formatBytes(bytes = 0) {
  const value = Number(bytes || 0);
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(2)} GB`;
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${value} B`;
}

function formatUptime(seconds = 0) {
  const total = Math.max(0, Math.floor(Number(seconds || 0)));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

async function react(sock, msg, emoji) {
  try {
    if (!msg?.key) return;
    await sock.sendMessage(msg.key.remoteJid, {
      react: {
        text: emoji,
        key: msg.key,
      },
    });
  } catch {}
}

export default {
  command: ["ping", "speed"],
  categoria: "sestema",
  description: "Mostra a latência do bot",

  run: async ({ sock, msg, from }) => {
    try {
      const start = process.hrtime.bigint();
      await react(sock, msg, "🏓");

      const sent = await sock.sendMessage(
        from,
        {
          text: "🏓 *Medindo velocidade do bot...*",
          ...global.channelInfo,
        },
        { quoted: msg }
      );

      const end = process.hrtime.bigint();
      const latencyMs = Number(end - start) / 1_000_000;
      const mem = process.memoryUsage();

      return await sock.sendMessage(
        from,
        {
          text: [
            "╭━━━〔 🏓 *PING FSOCIETY* 〕━━━⬣",
            "┃",
            `┃ ⚡ *Latência:* ${latencyMs.toFixed(0)} ms`,
            `┃ 🚀 *Uptime:* ${formatUptime(process.uptime())}`,
            `┃ 📦 *RAM bot:* ${formatBytes(mem.rss)}`,
            `┃ 🧠 *Heap usado:* ${formatBytes(mem.heapUsed)}`,
            "╰━━━━━━━━━━━━━━━━━━━━⬣",
          ].join("\n"),
          ...global.channelInfo,
        },
        { quoted: sent }
      );
    } catch (erro) {
      console.erro("PING ERROR:", erro);
      await react(sock, msg, "❌");
      return await sock.sendMessage(
        from,
        {
          text: "❌ Erro ao medir o ping.",
          ...global.channelInfo,
        },
        { quoted: msg }
      );
    }
  },
};