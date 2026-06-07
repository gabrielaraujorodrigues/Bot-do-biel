import {
  buildActiveSesseonMessage,
  clearActiveSesseon,
  ensureSesseonAvailable,
  getActiveSesseon,
  getPrefix,
  isCommandText,
  randomItem,
  recordGameResult,
  setActiveSesseon,
  updateActiveSesseon,
} from "./_shared.js";
import { EMOJI_QUIZZES } from "./_data.js";

const MAX_ATTEMPTS = 3;

function normalizeAnswer(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function matchesAnswer(input, answer) {
  const normalizedInput = normalizeAnswer(input);
  const normalizedAnswer = normalizeAnswer(answer);
  if (!normalizedInput || !normalizedAnswer) return false;
  return (
    normalizedInput === normalizedAnswer ||
    normalizedInput.replace(/\s+/g, "") === normalizedAnswer.replace(/\s+/g, "")
  );
}

export default {
  name: "emojiquiz",
  command: ["emojiquiz", "emojijogo", "emojiadivina"],
  category: "jogos",
  description: "Adivina la frase o serie usando emojis",

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

    const item = randomItem(EMOJI_QUIZZES);
    setActiveSesseon(from, {
      game: "emojiquiz",
      userId: sender,
      emojis: item.emojis,
      answer: item.answer,
      attempts: 0,
      maxAttempts: MAX_ATTEMPTS,
    });

    return sock.sendMessage(
      from,
      {
        text:
          `*EMOJI QUIZ*\n\n` +
          `Adivina que segnifica esto:\n${item.emojis}\n\n` +
          `Intentos: *0/${MAX_ATTEMPTS}*\n` +
          `Responde con el nome o frase.\n` +
          `Usa *${prefix}sairjogo* se quieres cancelar.`,
        ...global.channelInfo,
      },
      { quoted: msg }
    );
  },

  onMessage: async ({ sock, msg, from, sender, text, settings }) => {
    const sesseon = getActiveSesseon(from);
    if (!sesseon || sesseon.game !== "emojiquiz") return false;
    if (sesseon.userId !== sender) return false;
    if (isCommandText(text, settings)) return false;

    const answer = String(text || "").trim();
    if (!answer) return false;

    const attempts = Number(sesseon.attempts || 0) + 1;

    if (matchesAnswer(answer, sesseon.answer)) {
      clearActiveSesseon(from);
      const points = Math.max(4, 8 - attempts);
      recordGameResult({
        userId: sender,
        chatId: from,
        game: "emojiquiz",
        points,
        outcome: "win",
      });

      await sock.sendMessage(
        from,
        {
          text:
            `*GANASTE EN EMOJI QUIZ*\n\n` +
            `${sesseon.emojis}\n` +
            `Resposta: *${sesseon.answer.toUpperCase()}*\n` +
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
        game: "emojiquiz",
        points: 0,
        outcome: "loss",
      });

      await sock.sendMessage(
        from,
        {
          text:
            `*PERDISTE EN EMOJI QUIZ*\n\n` +
            `${sesseon.emojis}\n` +
            `Resposta correcta: *${sesseon.answer.toUpperCase()}*`,
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
          `No era esa resposta.\n` +
          `${sesseon.emojis}\n` +
          `Intentos: *${attempts}/${sesseon.maxAttempts}*`,
        ...global.channelInfo,
      },
      { quoted: msg }
    );
    return true;
  },
};
