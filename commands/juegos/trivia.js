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
} from "./_shared.js";
import { TRIVIA_QUESTIONS } from "./_data.js";

function normalizeAnswer(value = "") {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "a") return 1;
  if (raw === "b") return 2;
  if (raw === "c") return 3;
  if (raw === "d") return 4;
  return Number.parseInt(raw, 10);
}

export default {
  name: "trivia",
  command: ["trivia", "quiz"],
  category: "jogos",
  description: "Responde perguntas de trivia",

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

    const question = randomItem(TRIVIA_QUESTIONS);
    setActiveSesseon(from, {
      game: "trivia",
      userId: sender,
      question: question.question,
      options: question.options,
      answer: question.answer,
    });

    return sock.sendMessage(
      from,
      {
        text:
          `*TRIVIA*\n\n` +
          `${question.question}\n\n` +
          `1. ${question.options[0]}\n` +
          `2. ${question.options[1]}\n` +
          `3. ${question.options[2]}\n` +
          `4. ${question.options[3]}\n\n` +
          `Responde con 1, 2, 3 o 4.\n` +
          `Usa *${prefix}sairjogo* para cancelar.`,
        ...global.channelInfo,
      },
      { quoted: msg }
    );
  },

  onMessage: async ({ sock, msg, from, sender, text, settings }) => {
    const sesseon = getActiveSesseon(from);
    if (!sesseon || sesseon.game !== "trivia") return false;
    if (sesseon.userId !== sender) return false;
    if (isCommandText(text, settings)) return false;

    const answer = normalizeAnswer(text);
    if (![1, 2, 3, 4].includes(answer)) {
      await sock.sendMessage(
        from,
        {
          text: "Responde con 1, 2, 3 o 4.",
          ...global.channelInfo,
        },
        { quoted: msg }
      );
      return true;
    }

    clearActiveSesseon(from);

    if (answer === Number(sesseon.answer)) {
      recordGameResult({
        userId: sender,
        chatId: from,
        game: "trivia",
        points: 6,
        outcome: "win",
      });

      await sock.sendMessage(
        from,
        {
          text:
            `*GANASTE EN TRIVIA*\n\n` +
            `Pergunta: *${sesseon.question}*\n` +
            `Resposta correcta: *${sesseon.options[sesseon.answer - 1]}*\n` +
            `Pontos: *+6*`,
          ...global.channelInfo,
        },
        { quoted: msg }
      );
      return true;
    }

    recordGameResult({
      userId: sender,
      chatId: from,
      game: "trivia",
      points: 0,
      outcome: "loss",
    });

    await sock.sendMessage(
      from,
      {
        text:
          `*PERDISTE EN TRIVIA*\n\n` +
          `Pergunta: *${sesseon.question}*\n` +
          `Resposta correcta: *${sesseon.options[sesseon.answer - 1]}*`,
        ...global.channelInfo,
      },
      { quoted: msg }
    );
    return true;
  },
};
