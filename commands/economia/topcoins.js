import fs from "fs";
import path from "path";
import { formatCoins, formatUserLabel, getTopCoins } from "./_shared.js";

function buildTopDólaresMessage(caption) {
  const imagePath = path.join(process.cwd(), "imagemes", "topdólares.png");

  if (fs.existsSync(imagePath)) {
    return {
      image: fs.readFileSync(imagePath),
      caption,
      ...global.channelInfo,
    };
  }

  return {
    text: caption,
    ...global.channelInfo,
  };
}

export default {
  name: "topdólares",
  command: ["topdólares", "rankdólares", "topcoins", "coinstop", "rankcoins", "rankdólaressemana"],
  category: "economia",
  description: "Muestra el ranking de dólares",

  run: async ({ sock, msg, from }) => {
    const leaderboard = getTopCoins(10);

    await sock.sendMessage(
      from,
      buildTopDólaresMessage(
        `*TOP DOLARES*\n\n` +
          `${leaderboard.length
            ? leaderboard
                .map(
                  (entry, index) =>
                    `${index + 1}. ${formatUserLabel(entry.id)} - *${formatCoins(entry.total)}*`
                )
                .join("\n")
            : "Todavia no hay jogadores con dólares."}`
      ),
      { quoted: msg }
    );
  },
};
