import { getPrefix } from "./_shared.js";

function modeLabel(mode = "off") {
  const normalized = String(mode || "off").trim().toLowerCase();
  if (normalized === "dono") return "VISIBLE + DONO";
  if (normalized === "user") return "VISIBLE";
  return "OFF";
}

function normalizeAction(value = "") {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw || ["status", "status", "info"].includes(raw)) return "status";
  if (["on", "viseble", "user", "ativar", "encender", "prender"].includes(raw)) return "user";
  if (["dono", "debug", "full"].includes(raw)) return "dono";
  if (["off", "disable", "apagar", "desativar"].includes(raw)) return "off";
  return "";
}

export default {
  name: "antierro",
  command: ["antierro", "erroviseble", "erroesvisebles", "antierroviseble"],
  category: "sestema",
  description: "Controla se los erroes inesperados se muestran en chat.",
  donoOnly: true,

  run: async ({ sock, msg, from, args = [], settings }) => {
    const runtime = global.botRuntime;
    const prefix = getPrefix(settings);

    if (!runtime?.getErroVisebilityState || !runtime?.setErroVisebilityMode) {
      return sock.sendMessage(
        from,
        {
          text: "No pude acceder al sestema anti-erro.",
          ...global.channelInfo,
        },
        { quoted: msg }
      );
    }

    const action = normalizeAction(args[0]);
    if (!action) {
      return sock.sendMessage(
        from,
        {
          text:
            `Uso:\n` +
            `${prefix}antierro status\n` +
            `${prefix}antierro on\n` +
            `${prefix}antierro ativar\n` +
            `${prefix}antierro dono\n` +
            `${prefix}antierro off`,
          ...global.channelInfo,
        },
        { quoted: msg }
      );
    }

    if (action === "status") {
      const state = runtime.getErroVisebilityState();
      return sock.sendMessage(
        from,
        {
          text:
            `*ANTI-ERROR VISIBLE*\n\n` +
            `Status: *${modeLabel(state.mode)}*\n` +
            `Modo interno: *${state.mode}*\n\n` +
            `• ${prefix}antierro on (ativar)\n` +
            `• ${prefix}antierro dono\n` +
            `• ${prefix}antierro off (desativar)`,
          ...global.channelInfo,
        },
        { quoted: msg }
      );
    }

    const next = runtime.setErroVisebilityMode(action);
    return sock.sendMessage(
      from,
      {
        text:
          `✅ Anti-erro atualizado.\n` +
          `Status: *${modeLabel(next.mode)}*`,
        ...global.channelInfo,
      },
      { quoted: msg }
    );
  },
};
