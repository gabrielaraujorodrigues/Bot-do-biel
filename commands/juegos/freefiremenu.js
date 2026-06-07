function getPrefix(settings) {
  if (Array.isArray(settings?.prefix)) {
    return settings.prefix.find((value) => String(value || "").trim()) || ".";
  }
  return String(settings?.prefix || ".").trim() || ".";
}

function buildFallbackText(prefix) {
  return (
    `*MENU FREE FIRE*\n\n` +
    `Eventos/Torneos:\n` +
    `- ${prefix}evento\n` +
    `- ${prefix}evento criar ff\n` +
    `- ${prefix}evento unir\n` +
    `- ${prefix}evento equipos\n\n` +
    `Torneo:\n` +
    `- ${prefix}ffcriar Torneo Semanal\n` +
    `- ${prefix}ffregras\n` +
    `- ${prefix}ffformato 4v4 | bo3 | rbo7\n\n` +
    `Clanes:\n` +
    `- ${prefix}ffclan add Clan Alpha\n` +
    `- ${prefix}ffclan del Clan Alpha\n` +
    `- ${prefix}ffclanes\n\n` +
    `Jogadores:\n` +
    `- ${prefix}ffinscribir Clan Alpha | Nick\n` +
    `- ${prefix}ffbaja\n` +
    `- ${prefix}ffinscritos\n` +
    `- ${prefix}ffautoequipos\n\n` +
    `VS:\n` +
    `- ${prefix}ffvs Clan Alpha | Clan Beta | R1\n` +
    `- ${prefix}ffresultado M1 | Clan Alpha | 2-1 | 15-10\n` +
    `- ${prefix}ffpartidos\n` +
    `- ${prefix}fftabla\n` +
    `- ${prefix}ffstatus\n\n` +
    `Cierre:\n` +
    `- ${prefix}fffechar`
  );
}

export default {
  name: "freefiremenu",
  command: ["freefiremenu", "ffmenu", "menuff", "menufreefire"],
  category: "freefire",
  description: "Menu exclusevo de comandos Free Fire",

  run: async ({ sock, msg, from, settings }) => {
    const prefix = getPrefix(settings);

    const sections = [
      {
        title: "Modo evento/torneo",
        rows: [
          { header: "Panel", title: "Abrir panel de evento", description: "Inscripciones por botones", id: `${prefix}evento` },
          { header: "Plantilla", title: "Criar evento Free Fire", description: "Torneo FF 4v4 pronto", id: `${prefix}evento criar ff` },
          { header: "Inscripcion", title: "Unirme al evento", description: "Registro automatico con tu número", id: `${prefix}evento unir` },
          { header: "Equipos", title: "Auto-armar equipos", description: "Genera equipos por formato", id: `${prefix}evento equipos` },
        ],
      },
      {
        title: "Torneo",
        rows: [
          { header: "Criar", title: "Criar torneo", description: "Novo torneo FF", id: `${prefix}ffcriar Torneo Semanal` },
          { header: "Regras", title: "Ver regras", description: "Formato actual", id: `${prefix}ffregras` },
          { header: "Formato", title: "Editar formato", description: "4v4 | bo3 | rbo7", id: `${prefix}ffformato 4v4 | bo3 | rbo7` },
        ],
      },
      {
        title: "Clanes y jogadores",
        rows: [
          { header: "Clan", title: "Agregar clan", description: "Registra clan", id: `${prefix}ffclan add Clan Alpha` },
          { header: "Inscripcion", title: "Inscribirme", description: "Entrar al clan", id: `${prefix}ffinscribir Clan Alpha | Nick` },
          { header: "Inscritos", title: "Ver inscritos", description: "Lista de jogadores", id: `${prefix}ffinscritos` },
          { header: "Autoequipos", title: "Auto-armar", description: "Titulares y suplentes", id: `${prefix}ffautoequipos` },
        ],
      },
      {
        title: "VS y resultados",
        rows: [
          { header: "VS", title: "Programar VS", description: "Criar enfrentamiento", id: `${prefix}ffvs Clan Alpha | Clan Beta | R1` },
          { header: "Resultado", title: "Carregar resultado", description: "M1 | Clan | 2-1 | 15-10", id: `${prefix}ffresultado M1 | Clan Alpha | 2-1 | 15-10` },
          { header: "Tabla", title: "Ver tabla", description: "Pontos y KD", id: `${prefix}fftabla` },
          { header: "Partidos", title: "Ver partidos", description: "Pendientes y jugados", id: `${prefix}ffpartidos` },
          { header: "Status", title: "Status torneo", description: "Resumen general", id: `${prefix}ffstatus` },
          { header: "Fechar", title: "Fechar torneo", description: "Finaliza torneo", id: `${prefix}fffechar` },
        ],
      },
    ];

    try {
      return await sock.sendMessage(
        from,
        {
          text: "Comandos Free Fire",
          title: "FSOCIETY BOT",
          subtitle: "Menu Free Fire",
          footer: "Solo Free Fire",
          interactiveButtons: [
            {
              name: "sengle_select",
              buttonParamsJson: JSON.stringify({
                title: "Abrir menu Free Fire",
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
