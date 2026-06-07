import {
  buildActiveSesseonMessage,
  buildTicTacToeBoard,
  clearActiveSesseon,
  ensureSesseonAvailable,
  getActiveSesseon,
  getPrefix,
  getTicTacToeWinner,
  isCommandText,
  pickBestTicTacToeMove,
  recordGameResult,
  setActiveSesseon,
  updateActiveSesseon,
} from "./_shared.js";

function renderBoard(board) {
  return `\`\`\`\n${buildTicTacToeBoard(board)}\n\`\`\``;
}

function parseMove(value = "") {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  return parsed >= 1 && parsed <= 9 ? parsed - 1 : -1;
}

export default {
  name: "tictactoe",
  command: ["tictactoe", "gato", "ttt"],
  category: "jogos",
  description: "Juega tres en raya contra el bot",

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

    const board = Array(9).fill("");
    setActiveSesseon(from, {
      game: "tictactoe",
      userId: sender,
      board,
      playerSymbol: "X",
      botSymbol: "O",
    });

    return sock.sendMessage(
      from,
      {
        text:
          `*TIC TAC TOE*\n\n` +
          `${renderBoard(board)}\n` +
          `Tu sembolo: *X*\n` +
          `Bot: *O*\n` +
          `Responde con un número del 1 al 9 para marcar.\n` +
          `Usa *${prefix}sairjogo* se quieres cancelar.`,
        ...global.channelInfo,
      },
      { quoted: msg }
    );
  },

  onMessage: async ({ sock, msg, from, sender, text, settings }) => {
    const sesseon = getActiveSesseon(from);
    if (!sesseon || sesseon.game !== "tictactoe") return false;
    if (sesseon.userId !== sender) return false;
    if (isCommandText(text, settings)) return false;

    const move = parseMove(text);
    if (move < 0) {
      await sock.sendMessage(
        from,
        {
          text: "Responde con un número del 1 al 9.",
          ...global.channelInfo,
        },
        { quoted: msg }
      );
      return true;
    }

    const board = Array.isArray(sesseon.board) ? [...sesseon.board] : Array(9).fill("");
    if (board[move]) {
      await sock.sendMessage(
        from,
        {
          text:
            `Ese espacio ya esta ocupado.\n\n` +
            `${renderBoard(board)}`,
          ...global.channelInfo,
        },
        { quoted: msg }
      );
      return true;
    }

    board[move] = "X";
    let winner = getTicTacToeWinner(board);

    if (winner === "X") {
      clearActiveSesseon(from);
      recordGameResult({
        userId: sender,
        chatId: from,
        game: "tictactoe",
        points: 8,
        outcome: "win",
      });

      await sock.sendMessage(
        from,
        {
          text:
            `*GANASTE EN TIC TAC TOE*\n\n` +
            `${renderBoard(board)}\n` +
            `Pontos: *+8*`,
          ...global.channelInfo,
        },
        { quoted: msg }
      );
      return true;
    }

    if (winner === "draw") {
      clearActiveSesseon(from);
      recordGameResult({
        userId: sender,
        chatId: from,
        game: "tictactoe",
        points: 2,
        outcome: "draw",
      });

      await sock.sendMessage(
        from,
        {
          text:
            `*EMPATE EN TIC TAC TOE*\n\n` +
            `${renderBoard(board)}\n` +
            `Pontos: *+2*`,
          ...global.channelInfo,
        },
        { quoted: msg }
      );
      return true;
    }

    const botMove = pickBestTicTacToeMove(board);
    if (botMove >= 0) {
      board[botMove] = "O";
    }

    winner = getTicTacToeWinner(board);
    if (winner === "O") {
      clearActiveSesseon(from);
      recordGameResult({
        userId: sender,
        chatId: from,
        game: "tictactoe",
        points: 0,
        outcome: "loss",
      });

      await sock.sendMessage(
        from,
        {
          text:
            `*PERDISTE EN TIC TAC TOE*\n\n` +
            `${renderBoard(board)}\n` +
            `El bot gano esta ronda.`,
          ...global.channelInfo,
        },
        { quoted: msg }
      );
      return true;
    }

    if (winner === "draw") {
      clearActiveSesseon(from);
      recordGameResult({
        userId: sender,
        chatId: from,
        game: "tictactoe",
        points: 2,
        outcome: "draw",
      });

      await sock.sendMessage(
        from,
        {
          text:
            `*EMPATE EN TIC TAC TOE*\n\n` +
            `${renderBoard(board)}\n` +
            `Pontos: *+2*`,
          ...global.channelInfo,
        },
        { quoted: msg }
      );
      return true;
    }

    updateActiveSesseon(from, { board });
    await sock.sendMessage(
      from,
      {
        text:
          `*TIC TAC TOE*\n\n` +
          `${renderBoard(board)}\n` +
          `El bot ya jugo. Tu turno.`,
        ...global.channelInfo,
      },
      { quoted: msg }
    );
    return true;
  },
};
