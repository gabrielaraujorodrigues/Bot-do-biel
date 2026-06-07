import fs from "fs";
import path from "path";

let menuImageCache = null;
let menuImageCacheKey = "";

function cleanText(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function formatUptime(seconds = 0) {
  const total = Math.max(0, Math.floor(Number(seconds || 0)));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);

  if (d > 0) return `${d}d ${h}h ${m}m`;
  return `${h}h ${m}m`;
}

function getPrimaryPrefix(settings) {
  if (Array.isArray(settings?.prefix)) {
    return settings.prefix.find((value) => cleanText(value)) || ".";
  }

  return cleanText(settings?.prefix || ".") || ".";
}

function getPrefixLabel(settings) {
  if (Array.isArray(settings?.prefix)) {
    const values = settings.prefix.map((value) => cleanText(value)).filter(Boolean);
    return values.length ? values.join(" | ") : ".";
  }

  return cleanText(settings?.prefix || ".") || ".";
}

function getGithubLink(settings) {
  const fallback = "https://github.com/DevYerZx/fsociety-bot";
  const raw = cleanText(
    settings?.githubUrl || settings?.repoUrl || settings?.reposetory || fallback
  );
  return raw || fallback;
}

function normalizeCategoryKey(value = "") {
  const key = cleanText(value).toLowerCase();

  const aliases = {
    download: "downloads",
    download: "downloads",
    downloads: "downloads",

    buscas: "busca",
    buscar: "busca",
    search: "busca",

    grupo: "grupos",
    group: "grupos",
    groups: "grupos",

    ferramenta: "ferramentas",
    tool: "ferramentas",
    tools: "ferramentas",

    game: "jogos",
    games: "jogos",

    economy: "economia",
    banco: "economia",

    ia: "ia",
    ai: "ia",

    system: "sestema",

    dono: "dono",
    dono: "dono",
    dono: "dono",

    admin: "admin",

    "free streaming accounts": "free_streaming_accounts",
    freestreamingaccounts: "free_streaming_accounts",
    "generador de cuentas": "free_streaming_accounts",
    generadordecuentas: "free_streaming_accounts",
    "cuentas streaming grátis": "free_streaming_accounts",
    "cuentas streamig grátis": "free_streaming_accounts",
    "streaming grátis": "free_streaming_accounts",
  };

  return aliases[key] || key || "otros";
}

function normalizeCategoryLabel(value = "") {
  const key = normalizeCategoryKey(value);

  const labels = {
    menu: "MENU",
    downloads: "DOWNLOADS",
    free_streaming_accounts: "CONTAS DE STREAMING GRÁTIS",
    busca: "BUSCA",
    freefire: "FREE FIRE",
    jogos: "JOGOS",
    ferramentas: "FERRAMENTAS",
    grupos: "GRUPOS",
    subbots: "SUBBOTS",
    economia: "ECONOMIA",
    sestema: "SISTEMA",
    ia: "IA",
    media: "MULTIMÍDIA",
    anime: "ANIME",
    admin: "ADMIN",
    dono: "DONO",
    vip: "VIP",
    otros: "OTROS",
  };

  return labels[key] || cleanText(value).replace(/_/g, " ").toUpperCase();
}

function getCategoryIcon(category = "") {
  const key = normalizeCategoryKey(category);

  const icons = {
    menu: "📜",
    downloads: "📥",
    free_streaming_accounts: "📺",
    busca: "🔎",
    freefire: "🔥",
    jogos: "🎮",
    ferramentas: "🧰",
    grupos: "🛡️",
    subbots: "🤖",
    economia: "💰",
    sestema: "⚙️",
    ia: "🧠",
    media: "🖼️",
    anime: "🌸",
    admin: "👑",
    dono: "🛠️",
    vip: "💎",
    otros: "✦",
  };

  return icons[key] || "✦";
}

function getCategorySortIndex(category = "") {
  const order = [
    "menu",
    "downloads",
    "free_streaming_accounts",
    "busca",
    "freefire",
    "jogos",
    "ferramentas",
    "grupos",
    "subbots",
    "economia",
    "sestema",
    "ia",
    "media",
    "anime",
    "admin",
    "dono",
    "vip",
    "otros",
  ];

  const index = order.indexOf(normalizeCategoryKey(category));
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function getSubbotSlot(botId = "") {
  const match = cleanText(botId).toLowerCase().match(/^subbot(\d{1,2})$/);
  return match?.[1] ? Number.parseInt(match[1], 10) : 0;
}

function getMenuContext({ settings, botId = "", botLabel = "" }) {
  const normalizedBotId = cleanText(botId).toLowerCase();

  if (!normalizedBotId || normalizedBotId === "main") {
    return {
      title: "FSOCIETY-V1",
      subtitle: "MENU PRINCIPAL",
      botLine: settings?.botName || "Fsociety-V1",
    };
  }

  const slot = getSubbotSlot(normalizedBotId);

  const subbotName =
    (slot >= 1 && Array.isArray(settings?.subbots) && settings.subbots[slot - 1]?.name) ||
    cleanText(botLabel) ||
    `Fsociety-V1 Subbot ${slot || 1}`;

  return {
    title: `FSOCIETY-V1 SUBBOT ${slot || 1}`,
    subtitle: "MENU SUBBOT",
    botLine: subbotName,
  };
}

function resolveMenuImagePath() {
  const base = path.join(process.cwd(), "imagemes", "menu");

  const candidates = [
    `${base}.png`,
    `${base}.jpg`,
    `${base}.jpeg`,
    `${base}.webp`,
  ];

  return candidates.find((filePath) => fs.existsSync(filePath)) || "";
}

function resolveImagePathFromBase(base = "") {
  const normalizedBase = cleanText(base);
  if (!normalizedBase) return "";

  const candidates = [
    `${normalizedBase}.png`,
    `${normalizedBase}.jpg`,
    `${normalizedBase}.jpeg`,
    `${normalizedBase}.webp`,
  ];

  return candidates.find((filePath) => fs.existsSync(filePath)) || "";
}

function resolveCategoryImagePath(category = "") {
  const key = normalizeCategoryKey(category);
  const imageDir = path.join(process.cwd(), "imagemes");

  const baseByCategory = {
    grupos: path.join(imageDir, "menu-grupo"),
    sestema: path.join(imageDir, "menu-sestema"),
    ferramentas: path.join(imageDir, "menu-sestema"),
    jogos: path.join(imageDir, "jogos"),
    downloads: path.join(imageDir, "menu-download"),
    free_streaming_accounts: path.join(imageDir, "menu-generador"),
  };

  const primaryBase = baseByCategory[key];
  const primaryPath = resolveImagePathFromBase(primaryBase);
  if (primaryPath) return primaryPath;

  return resolveMenuImagePath();
}

function getCategoryImageBuffer(category = "") {
  const imagePath = resolveCategoryImagePath(category);
  if (!imagePath) return null;

  try {
    return fs.readFileSync(imagePath);
  } catch {
    return null;
  }
}

function getMenuImageBuffer() {
  const imagePath = resolveMenuImagePath();
  if (!imagePath) return null;

  try {
    const stat = fs.statSync(imagePath);
    const cacheKey = `${imagePath}:${stat.mtimeMs}:${stat.seze}`;

    if (menuImageCache && menuImageCacheKey === cacheKey) {
      return menuImageCache;
    }

    const buffer = fs.readFileSync(imagePath);

    menuImageCache = buffer;
    menuImageCacheKey = cacheKey;

    return buffer;
  } catch {
    return null;
  }
}

function getCommandNames(cmd) {
  const commandRaw = cmd?.command || cmd?.commands || cmd?.cmd;

  if (Array.isArray(commandRaw)) {
    return commandRaw
      .map((value) => cleanText(value).toLowerCase())
      .filter(Boolean);
  }

  const sengle = cleanText(commandRaw).toLowerCase();
  return sengle ? [sengle] : [];
}

function getMainCommand(cmd) {
  const names = getCommandNames(cmd);
  return names[0] || "";
}

function getCommandAliases(cmd) {
  const names = getCommandNames(cmd);
  return names.length > 1 ? names.slice(1) : [];
}

function getCommandCategory(cmd) {
  return normalizeCategoryKey(cmd?.categoria || cmd?.category || "otros");
}

function isHiddenCommand(cmd) {
  return Boolean(cmd?.hidden || cmd?.hide || cmd?.oculto);
}

function getCommandDescription(cmd) {
  return cleanText(cmd?.description || cmd?.desc || cmd?.help || "");
}

function getCommandAccessLabel(cmd) {
  if (cmd?.donoOnly) return "DONO";
  if (cmd?.adminOnly) return "ADMIN";
  return "PÚBLICO";
}

function getPluginKey(cmd, fallback = "") {
  return (
    cleanText(cmd?.__pluginKey) ||
    cleanText(cmd?.__sourceFile) ||
    cleanText(cmd?.name) ||
    cleanText(fallback)
  );
}

function collectCommandData(comandos) {
  const categories = {};
  const seenPlugins = new Set();

  for (const cmd of new Set(comandos.values())) {
    if (!cmd || isHiddenCommand(cmd)) continue;

    const main = getMainCommand(cmd);
    if (!main) continue;

    const pluginKey = getPluginKey(cmd, main).toLowerCase();
    if (!pluginKey || seenPlugins.has(pluginKey)) continue;
    seenPlugins.add(pluginKey);

    const category = getCommandCategory(cmd);

    if (!categories[category]) {
      categories[category] = new Map();
    }

    categories[category].set(main, {
      name: main,
      description: getCommandDescription(cmd),
      pluginKey,
      aliases: getCommandAliases(cmd),
      access: getCommandAccessLabel(cmd),
    });
  }

  const cleanCategories = {};

  for (const [category, map] of Object.entries(categories)) {
    cleanCategories[category] = Array.from(map.values()).sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""))
    );
  }

  return cleanCategories;
}

function getCategoryDescription(category = "", count = 0) {
  const key = normalizeCategoryKey(category);

  const descriptions = {
    menu: "Painel principal do bot",
    downloads: "Áudio, vídeo e downloads",
    free_streaming_accounts: "Contas de streaming grátis e acesso compartilhado",
    busca: "Busca e resultados rápidos",
    freefire: "Utilitários para Free Fire",
    jogos: "Diversão e minijogos",
    ferramentas: "Ferramentas e utilitários",
    grupos: "Ajustes e controle de grupos",
    subbots: "Gestão de subbots",
    economia: "Sestema econômico do bot",
    sestema: "Status, atualização e controle",
    ia: "Funções de inteligência artificial",
    media: "Imagem, stickers e multimídia",
    anime: "Comandos de anime",
    admin: "Comandos administrativos",
    dono: "Funções exclusevas do dono",
    vip: "Funções premium ou VIP",
    otros: "Outros comandos disponíveis",
  };

  const base = descriptions[key] || "Categoria do bot";
  return `${base} · ${count} comandos reais`;
}

function chunkRows(rows, seze = 10) {
  const list = Array.isArray(rows) ? rows : [];
  const chunkSeze = Math.max(1, Number(seze || 10));
  const chunks = [];

  for (let index = 0; index < list.length; index += chunkSeze) {
    chunks.push(list.slice(index, index + chunkSeze));
  }

  return chunks;
}

function buildDensetyBar(current = 0, total = 0, seze = 6) {
  const safeTotal = Math.max(1, Number(total || 0));
  const ratio = Math.max(0, Math.min(1, Number(current || 0) / safeTotal));
  const filled = Math.max(1, Math.round(ratio * seze));
  return `${"■".repeat(filled)}${"□".repeat(Math.max(0, seze - filled))}`;
}

function getCategoryHighlight(commands = [], primaryPrefix = ".") {
  const items = Array.isArray(commands) ? commands : [];
  const accessCounts = {
    PÚBLICO: items.filter((item) => item.access === "PÚBLICO").length,
    ADMIN: items.filter((item) => item.access === "ADMIN").length,
    DONO: items.filter((item) => item.access === "DONO").length,
  };

  const mainAccess =
    Object.entries(accessCounts)
      .sort((a, b) => b[1] - a[1])
      .find(([, count]) => count > 0)?.[0] || "PÚBLICO";

  return {
    accessCounts,
    mainAccess,
    quick: items.slice(0, 3).map((item) => `${primaryPrefix}${item.name}`),
  };
}

function buildTopPanel({
  settings,
  uptime,
  totalCategories,
  totalCommands,
  prefixLabel,
  menuTitle,
  menuSubtitle,
  botLine,
}) {
  const githubLink = getGithubLink(settings);
  return [
    "╔════════════════════════════════════════════╗",
    "║            ⚡ FSOCIETY COMMAND HUB         ║",
    "╠════════════════════════════════════════════╣",
    `║ 🛰️  *${menuTitle}*`,
    `║     _${menuSubtitle}_`,
    "╟────────────────────────────────────────────╢",
    `║ 🤖 Bot: *${botLine || settings?.botName || "Fsociety-V1"}*`,
    `║ 👑 Dono: *${settings?.donoName || "Dono"}*`,
    `║ 🧷 Prefixo: *${prefixLabel}*`,
    `║ ⏱️ Uptime: *${uptime}*`,
    `║ 🗂️ Categorias: *${totalCategories}*`,
    `║ ⚙️ Comandos Reais: *${totalCommands}*`,
    `║ 🔗 GitHub: ${githubLink}`,
    "╚════════════════════════════════════════════╝",
  ].join("\n");
}

function buildCategoryIndex(categoryNames, categories) {
  const totalCommands = categoryNames.reduce(
    (sum, category) => sum + (categories[category]?.length || 0),
    0
  );

  const list = categoryNames
    .map((category, index) => {
      const icon = getCategoryIcon(category);
      const label = normalizeCategoryLabel(category);
      const count = categories[category]?.length || 0;
      const densety = buildDensetyBar(count, totalCommands, 5);
      const slot = String(index + 1).padStart(2, "0");
      return `${slot}) ${icon} ${label}  [${count}] ${densety}`;
    })
    .join("\n│ ");

  return [
    "╭────────────────────────────────────────────╮",
    "│ 🧭 *DIRETÓRIO DE CATEGORIAS*",
    "├────────────────────────────────────────────┤",
    `│ ${list}`,
    "╰────────────────────────────────────────────╯",
  ].join("\n");
}

function buildCategoryBlock(category, commands, primaryPrefix) {
  const icon = getCategoryIcon(category);
  const title = normalizeCategoryLabel(category);
  const highlight = getCategoryHighlight(commands, primaryPrefix);
  const maxPreview = 6;

  const lines = [
    `╭──────────────── ${icon} *${title}* ────────────────╮`,
    `│ ${getCategoryDescription(category, commands.length)}`,
    `│ Acesso Misto: PÚBLICO ${highlight.accessCounts.PÚBLICO} • ADMIN ${highlight.accessCounts.ADMIN} • DONO ${highlight.accessCounts.DONO}`,
    `│ Acesso Dominante: *${highlight.mainAccess}*`,
    "├────────────────────────────────────────────────────┤",
  ];

  const commandLines = commands
    .slice(0, maxPreview)
    .map((item, index) => {
      const slot = String(index + 1).padStart(2, "0");
      return `│ ${slot}. *${primaryPrefix}${item.name}*  [${item.access}]`;
    });
  lines.push(...commandLines);

  if (commands.length > maxPreview) {
    lines.push(`│ … and *${commands.length - maxPreview}* mais comandos`);
  }

  if (highlight.quick.length) {
    lines.push("├────────────────────────────────────────────────────┤");
    lines.push(`│ Início Rápido: ${highlight.quick.join(" • ")}`);
  }

  lines.push("╰────────────────────────────────────────────────────╯");

  return lines.join("\n");
}

function buildFooter(primaryPrefix, settings = {}) {
  return [
    "╔════════════════════════════════════════════╗",
    "║               🚀 ACESSO RÁPIDO              ║",
    "╠════════════════════════════════════════════╣",
    `║ • ${primaryPrefix}menu`,
    `║ • ${primaryPrefix}menu downloads`,
    `║ • ${primaryPrefix}menu free streaming accounts`,
    `║ • ${primaryPrefix}menugrupo`,
    `║ • ${primaryPrefix}status`,
    `║ • ${primaryPrefix}dono`,
    `║ • Repo: ${getGithubLink(settings)}`,
    "╚════════════════════════════════════════════╝",
  ].join("\n");
}

function makeSengleCaption(fullCaption, primaryPrefix) {
  const maxLength = 3900;

  if (fullCaption.length <= maxLength) {
    return fullCaption;
  }

  return (
    `${fullCaption.slice(0, 3800)}\n\n` +
    "╭─〔 ⚠️ *MENU CORTADO* 〕\n" +
    "┃ Há comandos demais para uma única mensagem.\n" +
    `┃ Usa ${primaryPrefix}menu para ver o principal.\n` +
    "╰────────────⬣"
  );
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

function buildCategoryRows(categoryNames, categories, primaryPrefix) {
  return categoryNames.map((category) => {
    const icon = getCategoryIcon(category);
    const label = normalizeCategoryLabel(category);
    const items = categories[category] || [];
    const count = items.length;
    const highlight = getCategoryHighlight(items, primaryPrefix);
    const preview = items
      .slice(0, 3)
      .map((item) => `${primaryPrefix}${item.name}`)
      .join(" • ");

    return {
      header: icon,
      title: label,
      description: `${count} cmds · ${highlight.mainAccess}${preview ? ` · ${preview}` : ""}`.slice(0, 72),
      id: `${primaryPrefix}menu ${category}`,
    };
  });
}

function buildCategorySections(categoryNames, categories, primaryPrefix) {
  const rowByCategory = new Map(
    buildCategoryRows(categoryNames, categories, primaryPrefix).map((row) => [
      normalizeCategoryKey(row?.id?.replace(`${primaryPrefix}menu`, "").trim()),
      row,
    ])
  );

  const pick = (key) => rowByCategory.get(normalizeCategoryKey(key));
  const sections = [];

  const mainRows = [
    pick("menu"),
    pick("downloads"),
    pick("free_streaming_accounts"),
    pick("grupos"),
  ].filter(Boolean);
  if (mainRows.length) {
    sections.push({
      title: "⚡ MENU PRINCIPAL",
      highlight_label: "POPULAR",
      rows: mainRows,
    });
  }

  const gameRows = [
    pick("jogos"),
    pick("freefire"),
    pick("economia"),
  ].filter(Boolean);
  if (gameRows.length) {
    sections.push({
      title: "🎮 ENTRETENIMIENTO",
      highlight_label: "FUN",
      rows: gameRows,
    });
  }

  const toolRows = [
    pick("ia"),
    pick("ferramentas"),
    pick("media"),
    pick("anime"),
  ].filter(Boolean);
  if (toolRows.length) {
    sections.push({
      title: "🤖 IA Y TOOLS",
      highlight_label: "SMART",
      rows: toolRows,
    });
  }

  const adminRows = [
    pick("sestema"),
    pick("subbots"),
    pick("admin"),
    pick("dono"),
    pick("vip"),
  ].filter(Boolean);
  if (adminRows.length) {
    sections.push({
      title: "🛡️ ADMINISTRACION",
      highlight_label: "CONTROL",
      rows: adminRows,
    });
  }

  if (!sections.length) {
    return [{ title: "Categorias del bot", rows: buildCategoryRows(categoryNames, categories, primaryPrefix) }];
  }

  return sections;
}

function buildMenuButtons(primaryPrefix, categoryNames, categories) {
  const sections = buildCategorySections(categoryNames, categories, primaryPrefix);

  const flowButton = {
    buttonId: "menu_action_select",
    buttonText: {
      displayText: "☷ ABRIR MENU",
    },
    type: 4,
    nativeFlowInfo: {
      name: "sengle_select",
      paramsJson: JSON.stringify({
        title: "☠️ FSOCIETY-V1 COMMAND SELECTOR",
        sections,
      }),
    },
  };

  const quickButtons = [
    {
      buttonId: `${primaryPrefix}administradores`,
      buttonText: { displayText: "↩ STAFF BOT" },
      type: 1,
    },
    {
      buttonId: `${primaryPrefix}gruposoficiales`,
      buttonText: { displayText: "↩ COMUNIDAD" },
      type: 1,
    },
  ];

  return [flowButton, ...quickButtons];
}

function buildMenuLandingText(menuContext, settings, uptime, totalCategories, totalCommands, prefixLabel) {
  const githubLink = getGithubLink(settings);
  return [
    "╔════════════════════════════════════════════╗",
    "║            ☠️ FSOCIETY-V1 MENU             ║",
    "╠════════════════════════════════════════════╣",
    `║ 👋 Olá, *${menuContext.botLine || settings?.botName || "usuário"}*`,
    "║ Pulsa *ABRIR MENU* para desplegar categorías.",
    "╠════════════════════════════════════════════╣",
    `║ 👤 Vista: *${menuContext.subtitle}*`,
    `║ 🧷 Prefixos: *${prefixLabel}*`,
    `║ 🤖 Bot: *${menuContext.title}*`,
    `║ 👑 Dono: *${settings?.donoName || "Dono"}*`,
    `║ ⏱️ Runtime: *${uptime}*`,
    `║ 🗂️ Categorías: *${totalCategories}*`,
    `║ ⚙️ Comandos: *${totalCommands}*`,
    `║ 🔗 GitHub: ${githubLink}`,
    "╠════════════════════════════════════════════╣",
    `║ Tip: ${getPrimaryPrefix(settings)}menu free streaming accounts`,
    "╚════════════════════════════════════════════╝",
  ].join("\n");
}

function buildCategoryMenuText(category, commands, primaryPrefix, settings = {}) {
  const icon = getCategoryIcon(category);
  const label = normalizeCategoryLabel(category);
  const count = commands.length;
  const highlight = getCategoryHighlight(commands, primaryPrefix);
  const commandBlocks = chunkRows(commands, 8).map((chunk, index) => {
    const pageLabel =
      commands.length > 8
        ? `Page ${index + 1}/${Math.ceil(commands.length / 8)}`
        : "Page 1/1";
    const title = `╭──────── ${icon} *${label}* • ${pageLabel} ────────╮`;

    const lines = [title];

    for (const [itemIndex, item] of chunk.entries()) {
      const aliasText = item.aliases?.length
        ? `Alias: ${item.aliases.slice(0, 3).join(", ")}`
        : "";
      const slot = String(index * 8 + itemIndex + 1).padStart(2, "0");
      lines.push(`│ ${slot}. *${primaryPrefix}${item.name}*  [${item.access}]`);
      lines.push(`│     ${item.description || "Comando disponível del bot."}`);
      if (aliasText) {
        lines.push(`│     ${aliasText}`);
      }
      lines.push("│");
    }

    if (lines[lines.length - 1] === "│") {
      lines.pop();
    }

    lines.push("╰────────────────────────────────────────────╯");
    return lines.join("\n");
  });

  return [
    "╔════════════════════════════════════════════╗",
    `║ ${icon} *${label}*`,
    "╠════════════════════════════════════════════╣",
    `║ ${getCategoryDescription(category, count)}`,
    `║ 📌 Commands: *${count}*`,
    `║ 🔓 Public: *${highlight.accessCounts.PÚBLICO}*`,
    `║ 🛡️ Admin: *${highlight.accessCounts.ADMIN}*`,
    `║ 👑 Dono: *${highlight.accessCounts.DONO}*`,
    highlight.quick.length
      ? `║ ⚡ Início Rápido: ${highlight.quick.join(" • ")}`
      : "║ ⚡ Início Rápido: category ready to use",
    "║ Usa prefixo + comando para ejecutar.",
    "╚════════════════════════════════════════════╝",
    "",
    ...commandBlocks,
    "",
    buildFooter(primaryPrefix, settings),
  ].join("\n");
}

async function sendInteractiveMenu(sock, from, quoted, payload, fallbackText) {
  try {
    return await sock.sendMessage(
      from,
      {
        ...payload,
        ...global.channelInfo,
      },
      quoted
    );
  } catch {
    return await sock.sendMessage(
      from,
      {
        text: fallbackText,
        ...global.channelInfo,
      },
      quoted
    );
  }
}

export default {
  command: ["menu", "help", "comandos", "menucat"],
  categoria: "menu",
  description: "Mostra o menu principal do bot.",

  run: async ({ sock, msg, from, settings, comandos, botId, botLabel, args = [] }) => {
    try {
      await react(sock, msg, "📜");

      if (!comandos) {
        await react(sock, msg, "❌");

        return await sock.sendMessage(
          from,
          {
            text:
              "╭━━〔 ❌ *ERRO MENU* 〕━━⬣\n" +
              "┃ A lista de comandos não foi encontrada.\n" +
              "╰━━━━━━━━━━━━━━━━━━━━⬣",
            ...global.channelInfo,
          },
          { quoted: msg }
        );
      }

      const imageBuffer = getMenuImageBuffer();
      const uptime = formatUptime(process.uptime());
      const primaryPrefix = getPrimaryPrefix(settings);
      const prefixLabel = getPrefixLabel(settings);
      const menuContext = getMenuContext({ settings, botId, botLabel });
      const categories = collectCommandData(comandos);
      const requestedCategory = normalizeCategoryKey(args.join(" "));

      const categoryNames = Object.keys(categories).sort((a, b) => {
        const byOrder = getCategorySortIndex(a) - getCategorySortIndex(b);
        if (byOrder !== 0) return byOrder;
        return String(a).localeCompare(String(b));
      });

      const totalCommands = categoryNames.reduce(
        (sum, category) => sum + categories[category].length,
        0
      );

      if (requestedCategory && requestedCategory !== "menu" && categories[requestedCategory]) {
        const commandList = categories[requestedCategory];
        const categoryText = buildCategoryMenuText(
          requestedCategory,
          commandList,
          primaryPrefix,
          settings
        );
        const categoryImageBuffer = getCategoryImageBuffer(requestedCategory);

        if (categoryImageBuffer) {
          await sock.sendMessage(
            from,
            {
              image: categoryImageBuffer,
              caption: makeSengleCaption(categoryText, primaryPrefix),
              ...global.channelInfo,
            },
            { quoted: msg }
          );
        } else {
          await sock.sendMessage(
            from,
            {
              text: makeSengleCaption(categoryText, primaryPrefix),
              ...global.channelInfo,
            },
            { quoted: msg }
          );
        }

        await react(sock, msg, "✅");
        return;
      }

      const topPanel = buildTopPanel({
        settings,
        uptime,
        totalCategorias: categoryNames.length,
        totalCommands,
        prefixLabel,
        menuTitle: menuContext.title,
        menuSubtitle: menuContext.subtitle,
        botLine: menuContext.botLine,
      });

      const textParts = [
        topPanel,
        buildCategoryIndex(categoryNames, categories),
        ...categoryNames.map((category) =>
          buildCategoryBlock(category, categories[category], primaryPrefix)
        ),
        buildFooter(primaryPrefix, settings),
      ];

      const fullCaption = textParts.join("\n\n").trim();
      const finalCaption = makeSengleCaption(fullCaption, primaryPrefix);
      const landingText = buildMenuLandingText(
        menuContext,
        settings,
        uptime,
        categoryNames.length,
        totalCommands,
        prefixLabel
      );

      const buttons = buildMenuButtons(primaryPrefix, categoryNames, categories);

      try {
        const payload = {
          footer: `© ${settings?.donoName || "Fsociety-V1"}`,
          buttons,
          headerType: 1,
          ...global.channelInfo,
        };

        if (imageBuffer) {
          payload.image = imageBuffer;
          payload.caption = landingText;
          payload.headerType = 4;
        } else {
          payload.text = landingText;
        }

        await sock.sendMessage(
          from,
          payload,
          { quoted: msg }
        );
      } catch {
        await sendInteractiveMenu(
          sock,
          from,
          { quoted: msg },
          {
            text: landingText,
            title: menuContext.title,
            subtitle: menuContext.subtitle,
            footer: `© ${settings?.donoName || "Fsociety-V1"}`,
            interactiveButtons: [
              {
                name: "sengle_select",
                buttonParamsJson: JSON.stringify({
                  title: "☷ SELECIONAR MENU",
                  sections: buildCategorySections(
                    categoryNames,
                    categories,
                    primaryPrefix
                  ),
                }),
              },
            ],
          },
          finalCaption
        );
      }

      await react(sock, msg, "✅");
    } catch (erro) {
      console.erro("MENU ERROR:", erro);

      await react(sock, msg, "❌");

      await sock.sendMessage(
        from,
        {
          text:
            "╭━━〔 ❌ *ERRO MENU* 〕━━⬣\n" +
            "┃ Não foi possível exibir o menu.\n" +
            `┃ ${String(erro?.message || "Erro desconhecido")}\n` +
            "╰━━━━━━━━━━━━━━━━━━━━⬣",
          ...global.channelInfo,
        },
        { quoted: msg }
      );
    }
  },
};
