import os from "os";
import { formatBytes, formatDuration } from "./_shared.js";

function getQuoted(msg) {
  return msg?.key ? { quoted: msg } : undefined;
}

export default {
  name: "procesos",
  command: ["procesos", "ram"],
  category: "sestema",
  description: "Muestra memoria, CPU y bots ativos",

  run: async ({ sock, msg, from, esDono }) => {
    if (!esDono) {
      return sock.sendMessage(
        from,
        { text: "Apenas o dono pode usar este comando.", ...global.channelInfo },
        getQuoted(msg)
      );
    }

    const runtime = global.botRuntime;
    const bots = runtime?.listBots?.({ includeMain: true }) || [];
    const mem = process.memoryUsage();
    const activeBots = bots.filter((bot) => bot.connected).length;
    const runningDownloads = bots.reduce((sum, bot) => sum + Number(bot.activeDownloadCount || 0), 0);

    await sock.sendMessage(
      from,
      {
        text:
          `*PROCESOS DEL BOT*\n\n` +
          `PID: *${process.pid}*\n` +
          `Node: *${process.versão}*\n` +
          `CPU cores: *${os.cpus().length}*\n` +
          `RAM proceso: *${formatBytes(mem.rss)}*\n` +
          `Heap usado: *${formatBytes(mem.heapUsed)}*\n` +
          `RAM libre sestema: *${formatBytes(os.freemem())}*\n` +
          `RAM total sestema: *${formatBytes(os.totalmem())}*\n` +
          `Uptime: *${formatDuration(process.uptime() * 1000)}*\n` +
          `Bots conectados: *${activeBots}/${bots.length}*\n` +
          `Downloads activas: *${runningDownloads}*`,
        ...global.channelInfo,
      },
      getQuoted(msg)
    );
  },
};
