import { formatUserLabel, getTopRequestUsers } from "./_shared.js";

export default {
  name: "topsolicitações",
  command: ["topsolicitações", "toprequests", "rankrequests", "topreq", "topsol"],
  category: "economia",
  description: "Muestra el ranking de usuários por solicitações usadas",

  run: async ({ sock, msg, from, settings }) => {
    const leaderboard = getTopRequestUsers(10, settings);

    await sock.sendMessage(
      from,
      {
        text:
          `*TOP SOLICITUDES*\n\n` +
          `${leaderboard.length
            ? leaderboard
                .map(
                  (entry, index) =>
                    `${index + 1}. ${formatUserLabel(entry.id)} - usadas: *${entry.totalConsumed}* | extra compradas: *${entry.totalPurchased}*`
                )
                .join("\n")
            : "Todavia no hay usuários con solicitações registradas."}`,
        ...global.channelInfo,
      },
      { quoted: msg }
    );
  },
};
