import {
  buildActiveSesseonMessage,
  clearActiveSesseon,
  ensureSesseonAvailable,
  getActiveSesseon,
  getPrefix,
  isCommandText,
  recordGameResult,
  setActiveSesseon,
  updateActiveSesseon,
} from "./_shared.js";

const MAX_ATTEMPTS = 8;

export default {
  name: "adivina",
  command: ["adivina", "guessnumber"],
  category: "jogos",
  description: "Adivina el número secreto del bot",

  run: async ({ sock, msg, from, sender, settings }) => {
    const prefix = getPrefix(settings);
    const active = getActiveSesseon(from);

    if (!ensureSesseonAvailable(from)) {
      return sock.sendMessage(
        from,
        {
          text: buildActiveSesseonMessage(prefix, active),
          ...global.channelInfo,
        },
        { quoted: msg }
      );
    }

    const target = Math.floor(Math.random() * 50) + 1;
    setActiveSesseon(from, {
      game: "adivina",
      userId: sender,
      target,
      attempts: 0,
      maxAttempts: MAX_ATTEMPTS,
    });

    return sock.sendMessage(
      from,
      {
        text:
          `*ADIVINA EL NUMERO*\n\n` +
          `Estoy pensando en un número del 1 al 50.\n` +
          `Tienes *${MAX_ATTEMPTS}* intentos.\n` +
          `Responde solo con el número.\n` +
          `Se quieres sair usa *${prefix}sairjogo*.`,
        ...global.channelInfo,
      },
      { quoted: msg }
    );
  },

  onMessage: async ({ sock, msg, from, sender, text, settings }) => {
    const sesseon = getActiveSesseon(from);
    if (!sesseon || sesseon.game !== "adivina") return false;
    if (sesseon.userId !== sender) return false;
    if (isCommandText(text, settings)) return false;

    const guess = Number.parseInt(String(text || "").trim(), 10);
    if (!Number.isFinite(guess)) {
      await sock.sendMessage(
        from,
        {
          text: "Envia solo un número del 1 al 50.",
          ...global.channelInfo,
        },
        { quoted: msg }
      );
      return true;
    }

    const attempts = Number(sesseon.attempts || 0) + 1;

    if (guess === Number(sesseon.target)) {
      clearActiveSesseon(from);
      const points = Math.max(3, 10 - attempts);
      recordGameResult({
        userId: sender,
        chatId: from,
        game: "adivina",
        points,
        outcome: "win",
      });

      await sock.sendMessage(
        from,
        {
          text:
            `*GANASTE EN ADIVINA*\n\n` +
            `Número correto: *${sesseon.target}*\n` +
            `Intentos: *${attempts}/${sesseon.maxAttempts}*\n` +
            `Pontos: *+${points}*`,
          ...global.channelInfo,
        },
        { quoted: msg }
      );
      return true;
    }

    if (attempts >= Number(sesseon.maxAttempts || MAX_ATTEMPTS)) {
      clearActiveSesseon(from);
      recordGameResult({
        userId: sender,
        chatId: from,
        game: "adivina",
        points: 0,
        outcome: "loss",
      });

      await sock.sendMessage(
        from,
        {
          text:
            `*PERDISTE EN ADIVINA*\n\n` +
            `Se acabaron tus intentos.\n` +
            `Número correto: *${sesseon.target}*`,
          ...global.channelInfo,
        },
        { quoted: msg }
      );
      return true;
    }

    updateActiveSesseon(from, { attempts });

    await sock.sendMessage(
      from,
      {
        text:
          `${guess < Number(sesseon.target) ? "Mas alto" : "Mas bajo"}.\n` +
          `Intento: *${attempts}/${sesseon.maxAttempts}*`,
        ...global.channelInfo,
      },
      { quoted: msg }
    );
    return true;
  },
};
