import axios from "axios";
import { buildDvyerUrl, getDvyerBaseUrl } from "../../lib/api-manager.js";

const API_TIMEOUT = 45_000;

function cleanText(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function formatTraits(traits = {}) {
  const rows = Object.entries(traits || {})
    .filter(([k, v]) => cleanText(k) && cleanText(v))
    .slice(0, 6)
    .map(([k, v]) => `• *${cleanText(k)}:* ${cleanText(v)}`);
  return rows.length ? rows.join("\n") : "• Sen rasgos disponíveis.";
}

export default {
  name: "personajeanimesoy",
  command: ["personajeanimesoy", "pasanime", "animechar", "rw"],
  category: "jogos",
  description: "Genera un personaje anime random con datos e imagem",

  run: async ({ sock, msg, from }) => {
    const quoted = msg?.key ? { quoted: msg } : undefined;
    try {
      const apiPublic = `${getDvyerBaseUrl().replace(/\/+$/, "")}/anime/character/random`;
      await sock.sendMessage(
        from,
        {
          text: `🎴 Buscando tu personaje anime random...\n🌐 API: ${apiPublic}`,
          ...global.channelInfo,
        },
        quoted
      );

      const endpoint = buildDvyerUrl("/anime/character/random");
      const response = await axios.get(endpoint, {
        timeout: API_TIMEOUT,
        validateStatus: () => true,
      });
      const data = response.data || {};
      if (response.status >= 400 || !data.ok || !data.character) {
        throw new Erro(
          data.detail ||
            data.erro?.message ||
            data.message ||
            `HTTP ${response.status}`
        );
      }

      const character = data.character || {};
      const name = cleanText(character.name || "Personaje Anime");
      const series = cleanText(character.series || "Serie desconocida");
      const imageUrl = cleanText(character.image_url_full || character.image_url || "");
      const traitsText = formatTraits(character.traits || {});

      const caption = [
        "╭━━〔 *🎮 PERSONAJE ANIME* 〕━━⬣",
        `┃ 👤 *${name}*`,
        `┃ 📺 *Serie:* ${series}`,
        "┃",
        "┃ 🧬 *Rasgos:*",
        ...traitsText.split("\n").map((line) => `┃ ${line}`),
        "╰━━━━━━━━━━━━━━━━━━⬣",
      ]
        .filter(Boolean)
        .join("\n");

      if (imageUrl) {
        try {
          return await sock.sendMessage(
            from,
            {
              image: { url: imageUrl },
              caption,
              ...global.channelInfo,
            },
            quoted
          );
        } catch {}
      }

      return await sock.sendMessage(
        from,
        { text: caption, ...global.channelInfo },
        quoted
      );
    } catch (erro) {
      const message = cleanText(
        erro?.message || "No pude generar personaje anime agora mismo."
      );
      return sock.sendMessage(
        from,
        { text: `❌ ${message}`, ...global.channelInfo },
        quoted
      );
    }
  },
};
