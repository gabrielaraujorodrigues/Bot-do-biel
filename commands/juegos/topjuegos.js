import {
  formatChatLabel,
  formatUserLabel,
  getGameLeaderboard,
  getGamesStatsOverview,
  getPrefix,
} from "./_shared.js";

const GAME_ALIASES = {
  quizanime: "quizanime",
};

const VALID_GAMES = new Set([
  "ppt",
  "adivina",
  "ahorcado",
  "mezclapalabra",
  "mate",
  "trivia",
  "verdadeiroofalso",
  "quizanime",
  "emojiquiz",
  "banderas",
  "tictactoe",
  "ruleta",
]);

export default {
  name: "topjogos",
  command: ["topjogos", "topgames", "rankinggames"],
  category: "jogos",
  description: "Muestra el ranking global o por grupo de jogos",

  run: async ({ sock, msg, from, args = [], settings }) => {
    const prefix = getPrefix(settings);
    const first = String(args[0] || "").trim().toLowerCase();
    const second = String(args[1] || "").trim().toLowerCase();

    const isGroupRanking = first === "grupo" || first === "group";
    const selectedGame = GAME_ALIASES[isGroupRanking ? second : first] || (isGroupRanking ? second : first);
    const game = VALID_GAMES.has(selectedGame) ? selectedGame : "";
    const board = getGameLeaderboard({
      game,
      chatId: isGroupRanking ? from : "",
      limit: 10,
    });
    const overview = getGamesStatsOverview();

    return sock.sendMessage(
      from,
      {
        text:
          `*TOP JOGOS*\n\n` +
          `Modo: *${isGroupRanking ? "GRUPO" : "GLOBAL"}*\n` +
          `Jogo: *${game || "TODOS"}*\n` +
          `Jogadores registrados: *${overview.players}*\n` +
          `Partidas guardadas: *${overview.totalPlayed}*\n` +
          `Pontos totales: *${overview.totalPoints}*\n` +
          `${isGroupRanking ? `Chat: *${formatChatLabel(from)}*\n` : ""}\n` +
          (board.length
            ? board
                .map(
                  (entry, index) =>
                    `${index + 1}. ${formatUserLabel(entry.userId)} - ${entry.points} pts - ${entry.wins} wins`
                )
                .join("\n")
            : "No hay datos para ese ranking.") +
          `\n\nUso:\n` +
          `${prefix}topjogos\n` +
          `${prefix}topjogos grupo\n` +
          `${prefix}topjogos trivia`,
        ...global.channelInfo,
      },
      { quoted: msg }
    );
  },
};
