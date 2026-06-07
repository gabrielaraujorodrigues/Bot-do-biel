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
import { TRUE_FALSE_QUESTIONS } from "./_data.js";

function normalizeAnswer(value = "") {
  const raw = String(value || "").trim().toLowerCase();
  if (["v", "verdadeiro", "true", "se", "yes"].includes(raw)) return true;
  if (["f", "falso", "false", "no"].includes(raw)) return false;
  return null;
}

export default {
  name: "verdadeiroofalso",
  command: ["verdadeiroofalso", "vof", "truefalse"],
  category: "jogos",
  description: "Responde se una afirmacion es verdadera o falsa",

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

    const item = randomItem(TRUE_FALSE_QUESTIONS);
    setActiveSesseon(from, {
      game: "verdadeiroofalso",
      userId: sender,
      statement: item.statement,
      answer: Boolean(item.answer),
      explanation: String(item.explanation || "").trim(),
    });

    return sock.sendMessage(
      from,
      {
        text:
          `*VERDADERO O FALSO*\n\n` +
          `${item.statement}\n\n` +
          `Responde con *verdadeiro* o *falso*.\n` +
          `Também puedes usar *v* o *f*.\n` +
          `Usa *${prefix}sairjogo* para cancelar.`,
        ...global.channelInfo,
      },
      { quoted: msg }
    );
  },

  onMessage: async ({ sock, msg, from, sender, text, settings }) => {
    const sesseon = getActiveSesseon(from);
    if (!sesseon || sesseon.game !== "verdadeiroofalso") return false;
    if (sesseon.userId !== sender) return false;
    if (isCommandText(text, settings)) return false;

    const answer = normalizeAnswer(text);
    if (answer === null) {
      await sock.sendMessage(
        from,
        {
          text: "Responde solo con verdadeiro, falso, v o f.",
          ...global.channelInfo,
        },
        { quoted: msg }
      );
      return true;
    }

    clearActiveSesseon(from);

    if (answer === Boolean(sesseon.answer)) {
      recordGameResult({
        userId: sender,
        chatId: from,
        game: "verdadeiroofalso",
        points: 5,
        outcome: "win",
      });

      await sock.sendMessage(
        from,
        {
          text:
            `*GANASTE EN VERDADERO O FALSO*\n\n` +
            `Afirmacion: *${sesseon.statement}*\n` +
            `Resposta: *${sesseon.answer ? "VERDADERO" : "FALSO"}*\n` +
            `${sesseon.explanation ? `Dato: ${sesseon.explanation}\n` : ""}` +
            `Pontos: *+5*`,
          ...global.channelInfo,
        },
        { quoted: msg }
      );
      return true;
    }

    recordGameResult({
      userId: sender,
      chatId: from,
      game: "verdadeiroofalso",
      points: 0,
      outcome: "loss",
    });

    await sock.sendMessage(
      from,
      {
        text:
          `*PERDISTE EN VERDADERO O FALSO*\n\n` +
          `Afirmacion: *${sesseon.statement}*\n` +
          `Resposta correcta: *${sesseon.answer ? "VERDADERO" : "FALSO"}*\n` +
          `${sesseon.explanation ? `Dato: ${sesseon.explanation}` : ""}`,
        ...global.channelInfo,
      },
      { quoted: msg }
    );
    return true;
  },
};
