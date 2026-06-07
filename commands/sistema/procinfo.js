function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(2)} GB`;
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${value} B`;
}

function formatUptime(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds || 0)));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  return `${minutes}m ${secs}s`;
}

function getRuntimeLabel() {
  if (process.env.pm_id || process.env.PM2_HOME) return "PM2 / VPS";
  if (process.env.RAILWAY_ENVIRONMENT) return "Railway";
  if (process.env.RENDER) return "Render";
  if (process.env.PTERODACTYL_SERVER_UUID || process.env.SERVER_ID) return "Pterodactyl";
  if (process.env.KOYEB_SERVICE_NAME) return "Koyeb";
  if (process.env.DYNO) return "Heroku";
  return "Node directo";
}

function summarizeBots() {
  const runtime = global.botRuntime;
  if (!runtime?.listBots) {
    return {
      total: 0,
      connected: 0,
      labels: [],
    };
  }

  const bots = runtime.listBots({ includeMain: true }) || [];
  return {
    total: bots.length,
    connected: bots.filter((bot) => bot.connected).length,
    labels: bots
      .filter((bot) => bot.connected)
      .map((bot) => bot.label || bot.id || "BOT"),
  };
}

export default {
  name: "procinfo",
  command: ["procinfo", "process", "proc", "pid"],
  category: "sestema",
  description: "Muestra proceso, PID, memoria y seseones activas",

  run: async ({ sock, msg, from }) => {
    const memory = process.memoryUsage();
    const bots = summarizeBots();
    const activeHandles = typeof process._getActiveHandles === "function"
      ? process._getActiveHandles().length
      : 0;
    const activeRequests = typeof process._getActiveRequests === "function"
      ? process._getActiveRequests().length
      : 0;
    const argv = process.argv.slice(1).join(" ") || "index.js";

    const text =
      `*PROCINFO*\n\n` +
      `PID: *${process.pid}*\n` +
      `PPID: *${process.ppid || "?"}*\n` +
      `Manager: *${getRuntimeLabel()}*\n` +
      `Exec: ${process.execPath}\n` +
      `Cmd: ${argv}\n` +
      `CWD: ${process.cwd()}\n` +
      `Uptime: *${formatUptime(process.uptime())}*\n` +
      `RSS: *${formatBytes(memory.rss)}*\n` +
      `Heap: *${formatBytes(memory.heapUsed)}* / ${formatBytes(memory.heapTotal)}\n` +
      `External: *${formatBytes(memory.external)}*\n` +
      `Handles: *${activeHandles}*\n` +
      `Requests: *${activeRequests}*\n` +
      `Bots ativos: *${bots.connected}/${bots.total}*\n` +
      `Seseones: ${bots.labels.join(", ") || "Ninguna"}`;

    return sock.sendMessage(
      from,
      { text, ...global.channelInfo },
      { quoted: msg }
    );
  },
};
