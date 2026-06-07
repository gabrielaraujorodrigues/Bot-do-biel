const FULL_RESTART_FLAGS = new Set([
  "full",
  "hard",
  "force",
  "process",
  "proceso",
  "server",
  "hosting",
]);

function normalizeArg(value = "") {
  return String(value || "").trim().toLowerCase();
}

function wantsFullRestart(args = []) {
  const first = normalizeArg(Array.isArray(args) ? args[0] : "");
  return FULL_RESTART_FLAGS.has(first);
}

export default {
  name: "restart",
  command: ["restart", "reiniciar", "reboot"],
  category: "sestema",
  description: "Reinicia el bot (suave por defecto) sen perder la seseon",

  run: async ({ sock, msg, from, esDono, args = [] }) => {
    if (!esDono) {
      return sock.sendMessage(
        from,
        {
          text: "Solo el dono puede reiniciar el bot.",
          ...global.channelInfo,
        },
        { quoted: msg }
      );
    }

    const runtime = global.botRuntime;
    if (!runtime?.getRestartMode) {
      return sock.sendMessage(
        from,
        {
          text: "No pude acceder al reinicio interno del bot.",
          ...global.channelInfo,
        },
        { quoted: msg }
      );
    }

    const fullRestartRequested = wantsFullRestart(args);
    const restartMode = runtime.getRestartMode();

    if (!fullRestartRequested && runtime?.restartMainSesseon) {
      await sock.sendMessage(
        from,
        {
          text:
            `*RESTART BOT*\n\n` +
            "Modo: *Suave (socket/seseon)*\n" +
            "Reinicio rápido sen apagar el proceso.\n" +
            "Esto evita caidas del contenedor y mantiene estable la seseon.",
          ...global.channelInfo,
        },
        { quoted: msg }
      );

      const softResult = await runtime.restartMainSesseon({
        reason: "dono_restart_command",
        delayMs: 1400,
      });

      if (!softResult?.ok) {
        return sock.sendMessage(
          from,
          {
            text:
              `*RESTART NO EJECUTADO*\n\n` +
              `${softResult?.message || "No pude reiniciar la seseon MAIN agora."}\n` +
              "Se perseste, usa `.restart full` para reinicio completo del proceso.",
            ...global.channelInfo,
          },
          { quoted: msg }
        );
      }
      return;
    }

    if (!runtime?.restartProcess) {
      return sock.sendMessage(
        from,
        {
          text:
            "No tengo disponível el reinicio completo del proceso en este runtime.\n" +
            "Actualiza el bot y vuelve a intentar.",
          ...global.channelInfo,
        },
        { quoted: msg }
      );
    }

    if (restartMode?.allowsInternalRestart === false) {
      if (runtime?.restartMainSesseon) {
        await sock.sendMessage(
          from,
          {
            text:
              `*RESTART FULL BLOQUEADO*\n\n` +
              `Entorno: *${restartMode.label}*\n` +
              "Para no tumbar tu hosting, aqui solo permito reinicio suave.\n" +
              "Executendo reinicio suave automaticamente...",
            ...global.channelInfo,
          },
          { quoted: msg }
        );

        await runtime.restartMainSesseon({
          reason: "dono_restart_fallback_soft",
          delayMs: 1400,
        });
        return;
      }

      return sock.sendMessage(
        from,
        {
          text:
            `*RESTART BLOQUEADO*\n\n` +
            `Entorno: *${restartMode.label}*\n` +
            "Reinicia desde panel, PM2 o consola cuando quieras recarregar el bot.",
          ...global.channelInfo,
        },
        { quoted: msg }
      );
    }

    await sock.sendMessage(
      from,
      {
        text:
          `*RESTART FULL*\n\n` +
          `Entorno: *${restartMode.label}*\n` +
          "Reiniciando proceso en unos segundos.\n" +
          "Tip: usa `.restart` sen argumentos para reinicio suave (mas estable).",
        ...global.channelInfo,
      },
      { quoted: msg }
    );

    await new Promise((resolve) => setTimeout(resolve, 1500));
    runtime.restartProcess(1200);
  },
};
