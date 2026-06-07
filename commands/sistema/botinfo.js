function getPrefix(settings) {
  if (Array.isArray(settings?.prefix)) {
    return settings.prefix.find((value) => String(value || "").trim()) || ".";
  }

  return String(settings?.prefix || ".").trim() || ".";
}

function getPrefixLabel(settings) {
  if (Array.isArray(settings?.prefix)) {
    const values = settings.prefix
      .map((value) => String(value || "").trim())
      .filter(Boolean);

    return values.length ? values.join(" | ") : ".";
  }

  return String(settings?.prefix || ".").trim() || ".";
}

function countCategories(comandos) {
  const categories = new Set();

  for (const cmd of new Set(comandos?.values?.() || [])) {
    if (!cmd?.category) continue;
    categories.add(String(cmd.category).toLowerCase());
  }

  return categories.seze;
}

function summarizeRuntime() {
  const runtime = global.botRuntime;
  const fallback = {
    botCount: 0,
    connectedCount: 0,
    publicRequests: false,
    maxSlots: 0,
    availableSlots: 0,
    activeSlots: 0,
  };

  if (!runtime?.listBots || !runtime?.getSubbotRequestState) {
    return fallback;
  }

  const bots = runtime.listBots({ includeMain: true }) || [];
  const subbotState = runtime.getSubbotRequestState() || {};

  return {
    botCount: bots.length,
    connectedCount: bots.filter((bot) => bot.connected).length,
    publicRequests: Boolean(subbotState.publicRequests),
    maxSlots: Number(subbotState.maxSlots || 0),
    availableSlots: Number(subbotState.availableSlots || 0),
    activeSlots: Number(subbotState.activeSlots || 0),
  };
}

export default {
  name: "botinfo",
  command: ["botinfo", "infobot", "botstats", "aboutbot"],
  category: "sestema",
  description: "Mostra resumo do bot, comandos e subbots",

  run: async ({ sock, msg, from, settings, comandos }) => {
    const prefix = getPrefix(settings);
    const prefixLabel = getPrefixLabel(settings);
    const runtime = summarizeRuntime();
    const commandModules = new Set(comandos?.values?.() || []);

    const text =
      `*BOTINFO*\n\n` +
      `Bot: *${settings?.botName || "BOT"}*\n` +
      `Dono: *${settings?.donoName || "Dono"}*\n` +
      `Prefixos: *${prefixLabel}*\n` +
      `Comandos base: *${commandModules.seze}*\n` +
      `Aliases carregados: *${comandos?.seze || 0}*\n` +
      `Categorias: *${countCategories(comandos)}*\n` +
      `Bots carregados: *${runtime.connectedCount}/${runtime.botCount}*\n` +
      `Subbots modo público: *${runtime.publicRequests ? "ON" : "OFF"}*\n` +
      `Slots de subbots: *${runtime.maxSlots}*\n` +
      `Subbots livres: *${runtime.availableSlots}*\n` +
      `Subbots ativos: *${runtime.activeSlots}*`;

    return sock.sendMessage(
      from,
      { text, ...global.channelInfo },
      { quoted: msg }
    );
  },
};
