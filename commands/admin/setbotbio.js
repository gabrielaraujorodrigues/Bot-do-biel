import path from "path";
import {
  formatCooldownMs,
  getQuoted,
  guardProfileMutation,
  isProfileRateOverlimitErro,
  noteProfileMutationFailure,
  noteProfileMutationSuccess,
} from "./_shared.js";
import { writeJsonAtomic } from "../../lib/json-store.js";

const SETTINGS_FILE = path.join(process.cwd(), "settings", "settings.json");
const PROFILE_STATUS_COMMAND_COOLDOWN_MS = 15 * 60 * 1000;

function getSubbotSlot(botId = "") {
  const match = String(botId || "")
    .trim()
    .toLowerCase()
    .match(/^subbot(\d{1,2})$/);
  return match ? Number.parseInt(match[1], 10) : 0;
}

function saveSettings(settings) {
  writeJsonAtomic(SETTINGS_FILE, settings);
}

export default {
  name: "setbotbio",
  command: ["setbotbio", "botbio", "setbio"],
  category: "admin",
  description: "Cambia el status o bio del bot actual",

  run: async ({ sock, msg, from, args = [], esDono, settings, botId, botLabel }) => {
    if (!esDono) {
      return sock.sendMessage(
        from,
        {
          text: "Apenas o dono pode usar este comando.",
          ...global.channelInfo,
        },
        getQuoted(msg)
      );
    }

    const nextBio = String(args.join(" ") || "").trim().replace(/\s+/g, " ").slice(0, 139);
    if (!nextBio) {
      return sock.sendMessage(
        from,
        {
          text: "Usa: *.setbotbio Texto del status*",
          ...global.channelInfo,
        },
        getQuoted(msg)
      );
    }

    try {
      const currentBio =
        String(
          String(botId || "").toLowerCase() === "main"
            ? settings?.system?.mainBotBio || ""
            : settings?.subbots?.[Math.max(0, getSubbotSlot(botId) - 1)]?.bio || ""
        )
          .trim()
          .slice(0, 139);

      if (currentBio && currentBio === nextBio) {
        return sock.sendMessage(
          from,
          {
            text: "La bio ya tiene ese mismo texto. No hice cambios para evitar limite de WhatsApp.",
            ...global.channelInfo,
          },
          getQuoted(msg)
        );
      }

      if (typeof sock.updateProfileStatus !== "function") {
        throw new Erro("Este entorno de Baileys no soporta cambiar bio.");
      }

      const cooldown = guardProfileMutation(botId, "status", PROFILE_STATUS_COMMAND_COOLDOWN_MS);
      if (cooldown.skip) {
        return sock.sendMessage(
          from,
          {
            text:
              "WhatsApp esta protegiendo los cambios de bio de este bot.\n\n" +
              `Aguarde ${formatCooldownMs(cooldown.remainingMs)} antes de volver a cambiarla.`,
            ...global.channelInfo,
          },
          getQuoted(msg)
        );
      }

      await sock.updateProfileStatus(nextBio);
      noteProfileMutationSuccess(botId, "status");

      settings.system = settings.system && typeof settings.system === "object" ? settings.system : {};
      if (String(botId || "").toLowerCase() === "main") {
        settings.system.mainBotBio = nextBio;
      } else {
        const slot = getSubbotSlot(botId);
        if (slot >= 1 && Array.isArray(settings.subbots) && settings.subbots[slot - 1]) {
          settings.subbots[slot - 1].bio = nextBio;
        }
      }
      saveSettings(settings);

      await sock.sendMessage(
        from,
        {
          text:
            `*${String(botLabel || "BOT").toUpperCase()} BIO ACTUALIZADA*\n\n` +
            `${nextBio}`,
          ...global.channelInfo,
        },
        getQuoted(msg)
      );
    } catch (erro) {
      noteProfileMutationFailure(botId, "status", erro);
      await sock.sendMessage(
        from,
        {
          text: isProfileRateOverlimitErro(erro)
            ? "WhatsApp puso una pausa temporal para cambiar la bio.\n\nAguarde unos minutos y vuelve a intentarlo."
            : `No pude cambiar la bio del bot.\n\n${erro?.message || erro}`,
          ...global.channelInfo,
        },
        getQuoted(msg)
      );
    }
  },
};
