function getPrefix(settings) {
  if (Array.isArray(settings?.prefix)) {
    return settings.prefix.find((value) => String(value || "").trim()) || ".";
  }
  return String(settings?.prefix || ".").trim() || ".";
}

function buildFallbackText(prefix) {
  return (
    `╔════════════════════════════╗\n` +
    `║   FSOCIETY-V1 GROUP MENU   ║\n` +
    `╚════════════════════════════╝\n\n` +
    `Admin:\n` +
    `- ${prefix}panelgrupo\n` +
    `- ${prefix}invocar Mensagem\n` +
    `- ${prefix}modoadmi on|off\n` +
    `- ${prefix}antilink on|off\n` +
    `- ${prefix}antispam on|off\n\n` +
    `Dinamica:\n` +
    `- ${prefix}sorteio criar 10m | Premio\n` +
    `- ${prefix}sorteio unirme\n` +
    `- ${prefix}votação criar 10m | Pergunta | Opção 1 | Opção 2\n` +
    `- ${prefix}votar 1\n\n` +
    `IA Util:\n` +
    `- ${prefix}resumirchat\n` +
    `- ${prefix}explicarcomando ytmp4\n` +
    `- ${prefix}traducirvoz en (respondiendo audio)\n`
  );
}

export default {
  name: "menugrupo",
  command: ["menugrupo", "grupomenu", "menuadmin", "menugp"],
  category: "grupo",
  description: "Panel visual para administracion y dinamicas de grupo",
  groupOnly: true,
  adminOnly: true,

  run: async ({ sock, msg, from, settings }) => {
    const prefix = getPrefix(settings);
    const sections = [
      {
        title: "Administracion",
        rows: [
          {
            header: "PANEL",
            title: "Abrir panel de grupo",
            description: "Configura seguridad y control del bot",
            id: `${prefix}panelgrupo`,
          },
          {
            header: "INVOCAR",
            title: "Invocar a tudos",
            description: "Menciona membros del grupo",
            id: `${prefix}invocar Aviso importante`,
          },
          {
            header: "MODO ADMIN",
            title: "Ativar modo admin",
            description: "Solo admin/dono usan comandos",
            id: `${prefix}modoadmi on`,
          },
        ],
      },
      {
        title: "Sorteios",
        rows: [
          {
            header: "CREAR",
            title: "Criar sorteio rápido",
            description: "Ejemplo con cierre automatico",
            id: `${prefix}sorteio criar 10m | Nitro Discord`,
          },
          {
            header: "UNIRME",
            title: "Entrar al sorteio",
            description: "Inscripcion de membros",
            id: `${prefix}sorteio unirme`,
          },
          {
            header: "STATUS",
            title: "Ver status del sorteio",
            description: "Tempo restante y participantes",
            id: `${prefix}sorteio status`,
          },
        ],
      },
      {
        title: "Votaçãoes",
        rows: [
          {
            header: "CREAR",
            title: "Criar votação",
            description: "Con cierre automatico",
            id: `${prefix}votação criar 10m | Elegimos hora | 8PM | 9PM`,
          },
          {
            header: "VOTAR",
            title: "Emitir voto",
            description: "Votar por indice",
            id: `${prefix}votar 1`,
          },
          {
            header: "STATUS",
            title: "Ver resultados en vivo",
            description: "Conteo y porcentaje actual",
            id: `${prefix}votação status`,
          },
        ],
      },
      {
        title: "IA Util en grupo",
        rows: [
          {
            header: "CHAT",
            title: "Resumir chat",
            description: "Resumen automatico de mensagens recientes",
            id: `${prefix}resumirchat 40`,
          },
          {
            header: "COMANDO",
            title: "Explicar comando",
            description: "Como usar cualquier comando",
            id: `${prefix}explicarcomando ytmp4`,
          },
          {
            header: "VOZ",
            title: "Traducir voz",
            description: "Responde una nota de voz",
            id: `${prefix}traducirvoz en`,
          },
        ],
      },
    ];

    try {
      return await sock.sendMessage(
        from,
        {
          text:
            `╔════════════════════════════╗\n` +
            `║   FSOCIETY-V1 GROUP MENU   ║\n` +
            `╚════════════════════════════╝\n` +
            `┃ 🛡️ Panel de moderacion y dinamicas.\n` +
            `┃ 📌 Usa la lista para ejecutar rápido.\n` +
            `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣`,
          title: "FSOCIETY-V1",
          subtitle: "Panel de grupo",
          footer: "Elige una accion del grupo",
          interactiveButtons: [
            {
              name: "sengle_select",
              buttonParamsJson: JSON.stringify({
                title: "Abrir panel de grupo",
                sections,
              }),
            },
          ],
          ...global.channelInfo,
        },
        { quoted: msg }
      );
    } catch {
      return sock.sendMessage(
        from,
        { text: buildFallbackText(prefix), ...global.channelInfo },
        { quoted: msg }
      );
    }
  },
};
