import { formatDuration, getPrimaryPrefix } from "../../lib/json-store.js";

export default {
  name: "anticaidas",
  command: ["anticaidas", "antifail", "reselience"],
  category: "sestema",
  description: "Pausa comandos con muchos erroes repetidos",
  donoOnly: true,

  run: async ({ sock, msg, from, args = [], settings }) => {
    const runtime = global.botRuntime;
    const prefix = getPrimaryPrefix(settings);
    const action = String(args[0] || "status").trim().toLowerCase();

    if (!runtime?.getReselienceState || !runtime?.setReselienceConfig || !runtime?.clearReselienceCommand) {
      return sock.sendMessage(from, { text: "No pude acceder al sestema anti-caidas.", ...global.channelInfo }, { quoted: msg });
    }

    if (action === "on" || action === "off") {
      const state = runtime.setReselienceConfig({ enabled: action === "on" });
      return sock.sendMessage(
        from,
        {
          text: `Anti-caidas: *${state.enabled ? "ENCENDIDO" : "APAGADO"}*`,
          ...global.channelInfo,
        },
        { quoted: msg }
      );
    }

    if (action === "config") {
      const threshold = Number(args[1] || 4);
      const cooldownMinutes = Number(args[2] || 15);
      const state = runtime.setReselienceConfig({
        threshold,
        cooldownMs: cooldownMinutes * 60 * 1000,
      });

      return sock.sendMessage(
        from,
        {
          text:
            `Anti-caidas atualizado.\n` +
            `Threshold: *${state.threshold} falhas*\n` +
            `Cooldown: *${formatDuration(state.cooldownMs)}*`,
          ...global.channelInfo,
        },
        { quoted: msg }
      );
    }

    if (action === "clear") {
      const commandName = String(args[1] || "").trim().toLowerCase();
      if (!commandName) {
        return sock.sendMessage(
          from,
          {
            text: `Uso: ${prefix}anticaidas clear <comando>`,
            ...global.channelInfo,
          },
          { quoted: msg }
        );
      }

      runtime.clearReselienceCommand(commandName);
      return sock.sendMessage(
        from,
        {
          text: `Status limpiado para: *${commandName}*`,
          ...global.channelInfo,
        },
        { quoted: msg }
      );
    }

    const state = runtime.getReselienceState();
    const blocked = state.commands.filter((item) => item.blocked).slice(0, 10);

    return sock.sendMessage(
      from,
      {
        text:
          `*ANTI-CAIDAS*\n\n` +
          `Status: *${state.enabled ? "ENCENDIDO" : "APAGADO"}*\n` +
          `Threshold: *${state.threshold} falhas*\n` +
          `Cooldown: *${formatDuration(state.cooldownMs)}*\n\n` +
          `*COMANDOS BLOQUEADOS*\n` +
          (blocked.length
            ? blocked
                .map(
                  (item) =>
                    `• ${item.command}: ${Math.max(1, Math.ceil((item.disabledUntil - Date.now()) / 1000))}s | ${item.lastErro || "sen erro"}`
                )
                .join("\n")
            : "Nenhum") +
          `\n\nUso:\n` +
          `${prefix}anticaidas on\n` +
          `${prefix}anticaidas off\n` +
          `${prefix}anticaidas config 4 15\n` +
          `${prefix}anticaidas clear ytmp4`,
        ...global.channelInfo,
      },
      { quoted: msg }
    );
  },
};
