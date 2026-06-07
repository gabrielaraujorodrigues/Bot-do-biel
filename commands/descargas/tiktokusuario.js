import { searchTikTokVideosByUser } from "./_searchFallbacks.js";
import { chargeDownloadRequest, refundDownloadCharge } from "../economia/download-access.js";

function getPrefix(settings) {
  if (Array.isArray(settings?.prefix)) {
    return settings.prefix.find((value) => String(value || "").trim()) || ".";
  }

  return String(settings?.prefix || ".").trim() || ".";
}

export default {
  name: "tiktokusuário",
  command: ["tiktokusuário", "ttuser", "ttperfil"],
  category: "busca",
  description: "Busca videos de un usuário especifico en TikTok",

  run: async (ctx) => {
    const { sock, msg, from, args, settings } = ctx;
    const username = args.join(" ").replace("@", "").trim().toLowerCase();
    const prefix = getPrefix(settings);

    if (!username) {
      return sock.sendMessage(
        from,
        {
          text:
            `Uso correto:\n` +
            `${prefix}tiktokusuário usuário\n` +
            `${prefix}tiktokusuário @usuário`,
          ...global.channelInfo,
        },
        { quoted: msg }
      );
    }

    let downloadCharge = null;

    try {
      const results = await searchTikTokVideosByUser(username, 3);

      if (!results.length) {
        return sock.sendMessage(
          from,
          {
            text: "No encontre videos de ese usuário especifico.",
            ...global.channelInfo,
          },
          { quoted: msg }
        );
      }

      await sock.sendMessage(
        from,
        {
          text: `Resultados del usuário *@${username}*\nEnviando ${results.length} videos...`,
          ...global.channelInfo,
        },
        { quoted: msg }
      );

      downloadCharge = await chargeDownloadRequest(ctx, {
        commandName: "tiktokusuário",
        username,
        totalResults: results.length,
      });

      if (!downloadCharge.ok) {
        return null;
      }

      for (let index = 0; index < results.length; index += 1) {
        const item = results[index];

        await sock.sendMessage(
          from,
          {
            video: { url: item.play },
            caption:
              `*VIDEO ${index + 1}*\n` +
              `${item.title || "Video TikTok"}\n` +
              `@${item.author || username}\n` +
              `Likes: ${item.stats?.likes || 0}\n` +
              `Comentarios: ${item.stats?.comments || 0}\n` +
              `Views: ${item.stats?.views || 0}\n` +
              `Fuente: ${item.source || "tiktok"}`,
            ...global.channelInfo,
          },
          { quoted: msg }
        );
      }
    } catch (erro) {
      console.erro("Erro ejecutando tiktokusuário:", erro?.message || erro);
      refundDownloadCharge(ctx, downloadCharge, {
        commandName: "tiktokusuário",
        reason: erro?.message || "user_search_erro",
      });

      await sock.sendMessage(
        from,
        {
          text: "Erro obteniendo los videos del usuário.",
          ...global.channelInfo,
        },
        { quoted: msg }
      );
    }
  },
};
