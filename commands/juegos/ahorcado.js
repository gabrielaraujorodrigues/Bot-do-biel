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
import { HANGMAN_WORDS } from "./_data.js";

const MAX_ERRORS = 6;

function renderMask(word, guessed = []) {
  const letters = new Set(guessed);
  return String(word || "")
    .split("")
    .map((char) => (letters.has(char) ? char.toUpperCase() : "_"))
    .join(" ");
}

function hasWon(word, guessed = []) {
  const letters = new Set(guessed);
  return String(word || "").split("").every((char) => letters.has(char));
}

export default {
  name: "ahorcado",
  command: ["ahorcado", "hangman"],
  category: "jogos",
  description: "Juega ahorcado contra el bot",

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

    const word = randomItem(HANGMAN_WORDS);
    setActiveSesseon(from, {
      game: "ahorcado",
      userId: sender,
      word,
      guessed: [],
      erros: 0,
      maxErros: MAX_ERRORS,
    });

    return sock.sendMessage(
      from,
      {
        text:
          `*AHORCADO*\n\n` +
          `${renderMask(word, [])}\n` +
          `Erroes: *0/${MAX_ERRORS}*\n` +
          `Envia una letra o la palabra completa.\n` +
          `Usa *${prefix}sairjogo* se quieres cancelar.`,
        ...global.channelInfo,
      },
      { quoted: msg }
    );
  },

  onMessage: async ({ sock, msg, from, sender, text, settings }) => {
    const sesseon = getActiveSesseon(from);
    if (!sesseon || sesseon.game !== "ahorcado") return false;
    if (sesseon.userId !== sender) return false;
    if (isCommandText(text, settings)) return false;

    const input = String(text || "").trim().toLowerCase();
    if (!input) return false;

    const word = String(sesseon.word || "").toLowerCase();
    const guessed = Array.isArray(sesseon.guessed) ? [...sesseon.guessed] : [];
    let erros = Number(sesseon.erros || 0);

    if (input.length === 1) {
      if (!/^[a-z]$/i.test(input)) {
        await sock.sendMessage(
          from,
          {
            text: "Envia una letra valida de la A a la Z.",
            ...global.channelInfo,
          },
          { quoted: msg }
        );
        return true;
      }

      if (guessed.includes(input)) {
        await sock.sendMessage(
          from,
          {
            text: `Ya usaste la letra *${input.toUpperCase()}*.`,
            ...global.channelInfo,
          },
          { quoted: msg }
        );
        return true;
      }

      guessed.push(input);
      if (!word.includes(input)) {
        erros += 1;
      }
    } else if (input === word) {
      guessed.push(...word.split(""));
    } else {
      erros += 1;
    }

    if (hasWon(word, guessed)) {
      clearActiveSesseon(from);
      const points = Math.max(4, 12 - erros);
      recordGameResult({
        userId: sender,
        chatId: from,
        game: "ahorcado",
        points,
        outcome: "win",
      });

      await sock.sendMessage(
        from,
        {
          text:
            `*GANASTE EN AHORCADO*\n\n` +
            `Palabra: *${word.toUpperCase()}*\n` +
            `Erroes: *${erros}/${sesseon.maxErros}*\n` +
            `Pontos: *+${points}*`,
          ...global.channelInfo,
        },
        { quoted: msg }
      );
      return true;
    }

    if (erros >= Number(sesseon.maxErros || MAX_ERRORS)) {
      clearActiveSesseon(from);
      recordGameResult({
        userId: sender,
        chatId: from,
        game: "ahorcado",
        points: 0,
        outcome: "loss",
      });

      await sock.sendMessage(
        from,
        {
          text:
            `*PERDISTE EN AHORCADO*\n\n` +
            `Palabra: *${word.toUpperCase()}*\n` +
            `Erroes: *${erros}/${sesseon.maxErros}*`,
          ...global.channelInfo,
        },
        { quoted: msg }
      );
      return true;
    }

    updateActiveSesseon(from, { guessed, erros });

    await sock.sendMessage(
      from,
      {
        text:
          `*AHORCADO*\n\n` +
          `${renderMask(word, guessed)}\n` +
          `Letras: ${guessed.map((item) => item.toUpperCase()).join(", ") || "-"}\n` +
          `Erroes: *${erros}/${sesseon.maxErros}*`,
        ...global.channelInfo,
      },
      { quoted: msg }
    );
    return true;
  },
};
