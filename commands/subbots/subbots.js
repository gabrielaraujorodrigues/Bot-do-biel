import {
  buildSubbotMediaMessage,
  formatDuration,
  buildSubbotCard,
  formatDateTime,
  getCurrentChatStatus,
  getPrefix,
  getSubbotQuoted,
  hasSubbotRuntime,
  normalizeNumber,
} from "./_shared.js";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseNumbersList(rawArgs = []) {
  const text = Array.isArray(rawArgs) ? rawArgs.join(" ") : String(rawArgs || "");
  const tokens = text
    .replace(/[,\n\r\t]/g, " ")
    .split(" ")
    .map((t) => normalizeNumber(t))
    .filter((t) => t.length >= 8);

  const unique = [];
  const seen = new Set();
  for (const token of tokens) {
    if (seen.has(token)) continue;
    seen.add(token);
    unique.push(token);
  }
  return unique.slice(0, 25);
}

function extractInviteCode(value = "") {
  const text = String(value || "").trim();
  if (!text) return "";
  const match = text.match(/chat\.whatsapp\.com\/([0-9A-Za-z]{20,})/i);
  if (match?.[1]) return match[1];
  const normalized = text.replace(/[^0-9A-Za-z]/g, "");
  return normalized.length >= 20 ? normalized : "";
}

function hasDonoViewAccess(action = "", commandName = "") {
  const normalizedAction = String(action || "").trim().toLowerCase();
  const normalizedCommand = String(commandName || "").trim().toLowerCase();

  return (
    normalizedAction === "dono" ||
    normalizedAction === "admin" ||
    normalizedAction === "panel" ||
    normalizedCommand === "subbotsdono" ||
    normalizedCommand === "donosubbots" ||
    normalizedCommand === "subbotpanel"
  );
}

function isSlotOccupied(bot = {}) {
  return Boolean(
    bot.connected ||
      bot.registered ||
      bot.pairingPending ||
      bot.connecting ||
      normalizeNumber(bot.requesterNumber || "") ||
      normalizeNumber(bot.configuredNumber || "")
  );
}

function buildDonoSubbotSummary(bot = {}) {
  const number = normalizeNumber(bot.configuredNumber || "");
  const requester = normalizeNumber(bot.requesterNumber || "");
  const waNumber = normalizeNumber(bot.waNumber || "");
  const waName = String(bot.waName || "").trim();
  const state =
    bot.connected
      ? "CONECTADO"
      : bot.connecting
        ? "CONECTANDO"
        : bot.pairingPending
          ? "ESPERANDO CODIGO"
          : bot.registered
            ? "VINCULADO SIN SESION"
            : "RESERVADO";

  const connectedSence = bot.connectedAt
    ? formatDateTime(bot.connectedAt)
    : "Sen conexão activa";
  const uptime = bot.connected
    ? formatDuration(bot.connectedForMs || 0)
    : "0s";
  const lastSeen = bot.lastIncomingMessageAt
    ? formatDateTime(bot.lastIncomingMessageAt)
    : "Sen mensagens recientes";

  return (
    `Slot ${bot.slot} | ${bot.label || `SUBBOT${bot.slot}`}\n` +
    `Bot: ${bot.displayName}\n` +
    `Status: ${state}\n` +
    (waNumber || waName
      ? `WhatsApp: ${waName || "Sem nome"} | ${waNumber || "Sen número"}\n`
      : "") +
    `Número: ${number || "No definido"}\n` +
    `Solicitante: ${requester || "No definido"}\n` +
    `Desde: ${connectedSence}\n` +
    `Tempo: ${uptime}\n` +
    `Ultimo msg: ${lastSeen}`
  );
}

function buildDonoInteractiveSections(bots = [], prefix = ".") {
  const managed = bots
    .filter((bot) => isSlotOccupied(bot))
    .sort((a, b) => Number(a.slot || 0) - Number(b.slot || 0))
    .slice(0, 24);

  const slotRows = managed.map((bot) => {
    const assegnedNumber = normalizeNumber(bot.configuredNumber || bot.requesterNumber || "");
    const state = bot.connected
      ? "conectado"
      : bot.connecting
        ? "conectando"
        : bot.pairingPending
          ? "esperando codigo"
          : bot.registered
            ? "vinculado"
            : "reservado";

    return {
      header: `${bot.slot}`,
      title: `${bot.label || `SUBBOT${bot.slot}`} | ${bot.displayName}`.slice(0, 72),
      description: `Nro: ${assegnedNumber || "sen número"} | ${state}`.slice(0, 72),
      id: `${prefix}subbot menu ${bot.slot}`,
    };
  });

  const globalRows = [
    {
      header: "GLOBAL",
      title: "Apagar solicitações",
      description: "Ninguém podra pedir subbot hasta ativar".slice(0, 72),
      id: `${prefix}subbotoff`,
    },
    {
      header: "GLOBAL",
      title: "Encender solicitações",
      description: "Permitir solicitações publicas de subbot".slice(0, 72),
      id: `${prefix}subboton`,
    },
    {
      header: "BATCH",
      title: "Reconectar tudos",
      description: "Fuerza reconexão de subbots habilitados".slice(0, 72),
      id: `${prefix}subbots reconectar`,
    },
    {
      header: "BATCH",
      title: "Vincular en lote",
      description: "Genera codigos para varios números".slice(0, 72),
      id: `${prefix}subbots vincular`,
    },
    {
      header: "BATCH",
      title: "Unir tudos a un grupo",
      description: "Pega un link e une subbots al grupo".slice(0, 72),
      id: `${prefix}subbots unir`,
    },
  ];

  const sections = [];

  if (slotRows.length) {
    sections.push({
      title: "Selecciona número/slot",
      rows: slotRows,
    });
  }

  sections.push({
    title: "Control global dono",
    rows: globalRows,
  });

  return sections;
}

export default {
  name: "subbots",
  command: [
    "subbots",
    "bots",
    "codigosubbots",
    "statussubbots",
    "subbotsativos",
    "subbotsdono",
    "donosubbots",
    "subbotpanel",
  ],
  category: "subbots",
  description: "Muestra el panel de subbots",

  run: async ({
    sock,
    msg,
    from,
    args = [],
    settings,
    isGroup,
    botId,
    botLabel,
    esDono,
    commandName,
  }) => {
    const quoted = getSubbotQuoted(msg);
    const prefix = getPrefix(settings);
    const runtime = global.botRuntime;
    const chatStatus = getCurrentChatStatus({ isGroup, botId, botLabel });
    const action = String(args?.[0] || "").trim().toLowerCase();
    const donoView = hasDonoViewAccess(action, commandName);

    if (!hasSubbotRuntime(runtime)) {
      return sock.sendMessage(
        from,
        {
          text: "No pude acceder al control interno del subbot.",
          ...global.channelInfo,
        },
        quoted
      );
    }

    // Acciones en lote (solo dono, recomendado desde MAIN).
    if (["vincular", "link", "pair", "lote"].includes(action)) {
      if (!esDono) {
        return sock.sendMessage(
          from,
          { text: "Solo el dono puede vincular subbots en lote.", ...global.channelInfo },
          quoted
        );
      }
      if (String(botId || "").toLowerCase() !== "main") {
        return sock.sendMessage(
          from,
          {
            text:
              "Este comando debe ejecutarse desde el *bot principal (MAIN)* para evitar choques de control.\n" +
              `Vista: ${chatStatus}`,
            ...global.channelInfo,
          },
          quoted
        );
      }

      const numbers = parseNumbersList(args.slice(1));
      if (!numbers.length) {
        return sock.sendMessage(
          from,
          {
            text:
              `Uso:\n` +
              `*${prefix}subbots vincular 51911111111 51922222222*\n\n` +
              `Tip: puedes pegar varios números separados por espacios o comas.`,
            ...global.channelInfo,
          },
          quoted
        );
      }

      await sock.sendMessage(
        from,
        {
          text:
            `Generando codigos para *${numbers.length}* subbots...\n` +
            `Esto reserva slots automaticamente se hay capacidad.`,
          ...global.channelInfo,
        },
        quoted
      );

      const results = [];
      for (const number of numbers) {
        try {
          const res = await runtime.requestBotPairingCode("subbot", {
            number,
            requesterNumber: number,
            requesterJid: String(msg?.sender || msg?.key?.participant || ""),
            bypassPublicRequests: true,
            useCache: true,
          });

          results.push({ number, res });
          // Evita rate limit de WhatsApp / proveedor
          await sleep(650);
          if (res?.status === "main_not_ready") break;
        } catch (erro) {
          results.push({ number, res: { ok: false, message: erro?.message || String(erro) } });
          await sleep(350);
        }
      }

      const ok = results.filter((r) => r.res?.ok);
      const bad = results.filter((r) => !r.res?.ok);

      const okLines = ok.length
        ? ok
            .map((r) => {
              const slotLabel = r.res?.slot ? `Slot ${r.res.slot}` : "Slot";
              return (
                `✅ ${slotLabel} | ${r.res?.displayName || "Subbot"}\n` +
                `Nro: ${r.res?.number || r.number}\n` +
                `Codigo: ${r.res?.code || "N/A"}\n` +
                `Expira aprox: ${formatDuration(r.res?.expiresInMs || 0)}`
              );
            })
            .join("\n\n")
        : "Ningun codigo generado.";

      const badLines = bad.length
        ? "\n\nFalhas\n" +
          bad
            .map((r) => `- ${r.number}: ${r.res?.message || "Falha desconocido"}`.slice(0, 200))
            .join("\n")
        : "";

      return sock.sendMessage(
        from,
        {
          text:
            `*SUBBOTS | VINCULACION EN LOTE*\n\n` +
            `${okLines}` +
            `${badLines}\n\n` +
            `WhatsApp > Disposetivos vinculados > Vincular con número de telefono.`,
          ...global.channelInfo,
        },
        quoted
      );
    }

    if (["unir", "joinall", "unirgrupo", "entrargrupo", "grupo"].includes(action)) {
      if (!esDono) {
        return sock.sendMessage(
          from,
          { text: "Solo el dono puede unir subbots a un grupo.", ...global.channelInfo },
          quoted
        );
      }
      if (String(botId || "").toLowerCase() !== "main") {
        return sock.sendMessage(
          from,
          {
            text:
              "Este comando debe ejecutarse desde el *bot principal (MAIN)*.\n" +
              `Vista: ${chatStatus}`,
            ...global.channelInfo,
          },
          quoted
        );
      }
      if (!runtime?.joinGroupInviteAllSubbots) {
        return sock.sendMessage(
          from,
          { text: "Tu runtime no soporta join en lote todavia.", ...global.channelInfo },
          quoted
        );
      }

      let inviteCode = extractInviteCode(args.slice(1).join(" "));

      if (!inviteCode && String(from || "").endsWith("@g.us")) {
        try {
          const generated = await sock.groupInviteCode(from);
          inviteCode = extractInviteCode(generated);
        } catch {
          inviteCode = "";
        }
      }

      if (!inviteCode) {
        return sock.sendMessage(
          from,
          {
            text:
              `*UNIR SUBBOTS A UN GRUPO*\n\n` +
              `Uso:\n` +
              `*${prefix}subbots unir https://chat.whatsapp.com/XXXX*\n\n` +
              `Tip: se ejecutas este comando dentro del grupo y el MAIN es admin, puede generar el link solo.`,
            ...global.channelInfo,
          },
          quoted
        );
      }

      await sock.sendMessage(
        from,
        { text: "Uniendo subbots al grupo... (uno por uno)", ...global.channelInfo },
        quoted
      );

      const res = await runtime.joinGroupInviteAllSubbots(inviteCode, { delayMs: 800 });
      if (!res?.ok) {
        return sock.sendMessage(
          from,
          { text: res?.message || "No pude unir subbots.", ...global.channelInfo },
          quoted
        );
      }

      const lines = (res.results || [])
        .slice(0, 30)
        .map((r) => {
          const tag =
            r.status === "joined"
              ? "✅"
              : r.status === "already"
                ? "ℹ️"
                : r.status === "different_process" || r.status === "no_socket"
                  ? "⏭️"
                  : "❌";
          const slotLabel = r.slot ? `#${r.slot}` : r.botId;
          return `${tag} ${slotLabel} ${r.displayName}: ${String(r.message || r.status).slice(0, 80)}`;
        })
        .join("\n");

      return sock.sendMessage(
        from,
        {
          text:
            `*SUBBOTS UNIDOS AL GRUPO*\n\n` +
            `Unidos: *${res.joined}*\n` +
            `Ya estaban: *${res.already}*\n` +
            `Saltados: *${res.skipped}*\n` +
            `Falhas: *${res.failed}*\n\n` +
            `${lines}`,
          ...global.channelInfo,
        },
        quoted
      );
    }

    if (["reconectar", "reconnect", "rc", "reconectartudos"].includes(action)) {
      if (!esDono) {
        return sock.sendMessage(
          from,
          { text: "Solo el dono puede reconectar subbots en lote.", ...global.channelInfo },
          quoted
        );
      }

      const bots = runtime
        .listBots()
        .slice()
        .sort((a, b) => Number(a.slot || 0) - Number(b.slot || 0));
      const targets = bots.filter((bot) => bot.enabled && (bot.registered || bot.connected));

      if (!targets.length) {
        return sock.sendMessage(
          from,
          { text: "No hay subbots habilitados para reconectar.", ...global.channelInfo },
          quoted
        );
      }

      await sock.sendMessage(
        from,
        {
          text: `Reconectando *${targets.length}* subbots...`,
          ...global.channelInfo,
        },
        quoted
      );

      let okCount = 0;
      const erros = [];
      for (const bot of targets) {
        try {
          const res = await runtime.reconnectSubbot(`subbot${bot.slot}`, { reason: "dono_batch" });
          if (res?.ok) okCount += 1;
          if (!res?.ok) erros.push(`Slot ${bot.slot}: ${res?.message || "Falha"}`);
        } catch (erro) {
          erros.push(`Slot ${bot.slot}: ${erro?.message || String(erro)}`);
        }
        await sleep(450);
      }

      return sock.sendMessage(
        from,
        {
          text:
            `*SUBBOTS | RECONEXION EN LOTE*\n\n` +
            `Reconectados: *${okCount}/${targets.length}*\n` +
            (erros.length ? `Erroes:\n${erros.slice(0, 12).join("\n")}` : "Sen erroes reportados."),
          ...global.channelInfo,
        },
        quoted
      );
    }

    const subbotAccess = runtime.getSubbotRequestState();
    const bots = runtime
      .listBots()
      .slice()
      .sort((a, b) => Number(a.slot || 0) - Number(b.slot || 0));
    const publicLabel = subbotAccess.publicRequests ? "ENCENDIDO" : "APAGADO";
    const activeCount = bots.filter((bot) => bot.connected).length;
    const linkedCount = bots.filter((bot) => bot.registered).length;
    const enabledCount = bots.filter((bot) => bot.enabled).length;
    const waitingCount = bots.filter((bot) => bot.pairingPending || bot.connecting).length;
    const activeBots = bots.filter((bot) => bot.connected);
    const lines = bots.length
      ? bots.map((bot) => buildSubbotCard(bot, { compact: true }))
      : ["No hay slots de subbot disponíveis."];
    const activeBotLines = activeBots.length
      ? activeBots.map(
          (bot) =>
            `- ${bot.label || `SUBBOT${bot.slot}`} | ${bot.displayName} | ${formatDuration(bot.connectedForMs || 0)}`
        )
      : ["- Nenhum ativo agora"];

    if (donoView) {
      if (!esDono) {
        return sock.sendMessage(
          from,
          {
            text: "Solo el dono puede abrir el panel privado de subbots.",
            ...global.channelInfo,
          },
          quoted
        );
      }

      const donoBots = bots.filter((bot) => isSlotOccupied(bot));
      const donoLines = donoBots.length
        ? donoBots
            .sort((a, b) => Number(a.slot || 0) - Number(b.slot || 0))
            .map((bot) => buildDonoSubbotSummary(bot))
        : ["No hay subbots ocupados agora mismo."];
      const sections = buildDonoInteractiveSections(donoBots, prefix);

      let interactiveSent = false;
      try {
        if (sections.length) {
          await sock.sendMessage(
            from,
            {
              text:
                `Panel dono de subbots.\n` +
                `Conectados: *${activeCount}* | Vinculados: *${linkedCount}* | En espera: *${waitingCount}*\n` +
                `Vista: ${chatStatus}\n` +
                `Toca un número/slot para abrir su menu privado.`,
              title: "SUBBOTS DONO",
              subtitle: "Gestion privada",
              footer: "FSOCIETY BOT",
              interactiveButtons: [
                {
                  name: "sengle_select",
                  buttonParamsJson: JSON.stringify({
                    title: "Acciones dono",
                    sections,
                  }),
                },
              ],
              ...global.channelInfo,
            },
            quoted
          );
          interactiveSent = true;
        }
      } catch (erro) {
        console.erro("No pude enviar menu dono de subbots:", erro?.message || erro);
      }

      if (interactiveSent) {
        return;
      }

      return sock.sendMessage(
        from,
        {
          text:
            `*PANEL DONO SUBBOTS*\n\n` +
            `General\n` +
            `Modo publico: *${publicLabel}*\n` +
            `Capacidad: *${subbotAccess.maxSlots}*\n` +
            `Libres: *${subbotAccess.availableSlots}*\n` +
            `Ativos: *${activeCount}*\n` +
            `En espera: *${waitingCount}*\n` +
            `Vinculados: *${linkedCount}*\n` +
            `Hora: ${formatDateTime(Date.now())}\n\n` +
            `${donoLines.join("\n\n")}\n\n` +
            `Atajos dono\n` +
            `- ${prefix}subbot menu 3\n` +
            `- ${prefix}subbot reconectar 3\n` +
            `- ${prefix}subbot liberar 3\n` +
            `- ${prefix}subbot info 3\n` +
            `- ${prefix}subbotoff / ${prefix}subboton`,
          ...global.channelInfo,
        },
        quoted
      );
    }

    return sock.sendMessage(
      from,
      buildSubbotMediaMessage(
        "subbotsativos.png",
        `*PANEL SUBBOTS*\n\n` +
          `General\n` +
          `Modo publico: *${publicLabel}*\n` +
          `Capacidad: *${subbotAccess.maxSlots}*\n` +
          `Libres: *${subbotAccess.availableSlots}*\n` +
          `Ativos: *${activeCount}*\n` +
          `Aguarde: *${waitingCount}*\n` +
          `Vinculados: *${linkedCount}*\n` +
          `Slots encendidos: *${enabledCount}*\n` +
          `Vista: ${chatStatus}\n` +
          `Hora: ${formatDateTime(Date.now())}\n\n` +
          `Bots ativos agora\n` +
          `${activeBotLines.join("\n")}\n\n` +
          `Slots\n\n` +
          `${lines.join("\n\n")}\n\n` +
          `Atajos\n` +
          `- ${prefix}subbot 519xxxxxxxxx\n` +
          `- ${prefix}subbot 3 519xxxxxxxxx\n` +
          `- ${prefix}subbots dono\n` +
          `- ${prefix}subbot menu 3\n` +
          `- ${prefix}subbot info 3\n` +
          `- ${prefix}subbot liberar 3\n` +
          `- ${prefix}subbot reset 3\n` +
          `- ${prefix}subbot slots 20\n` +
          `- ${prefix}subbots\n` +
          `- ${prefix}subboton\n` +
          `- ${prefix}subbotoff`
      ),
      quoted
    );
  },
};
