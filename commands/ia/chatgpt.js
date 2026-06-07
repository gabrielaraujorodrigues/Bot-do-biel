import axios from "axios";
import { getGpt5Url, getProvider } from "../../lib/api-manager.js";

function getPrefix(settings) {
  if (Array.isArray(settings?.prefix)) {
    return settings.prefix.find((value) => String(value || "").trim()) || ".";
  }

  return String(settings?.prefix || ".").trim() || ".";
}

export default {
  name: "gpt5",
  command: ["gpt", "ai", "gpt5"],
  category: "ai",
  desc: "Chat com IA. Uso: .gpt5 <pergunta>",

  run: async ({ sock, msg, from, args, settings }) => {
    const prompt = args.join(" ").trim();
    const prefix = getPrefix(settings);

    if (!prompt) {
      return sock.sendMessage(
        from,
        { text: `❌ Uso:\n${prefix}gpt5 <pergunta>`, ...global.channelInfo },
        { quoted: msg }
      );
    }

    try {
      const provider = getProvider("ai");
      if (provider?.enabled === false) {
        return sock.sendMessage(
          from,
          { text: "A IA está desativada pelo dono.", ...global.channelInfo },
          { quoted: msg }
        );
      }

      const url = getGpt5Url(prompt);
      const { data } = await axios.get(url, { timeout: 60000 });

      if (!data?.status) {
        return sock.sendMessage(
          from,
          {
            text: `❌ Erro: ${data?.message || "Não foi possível obter resposta"}`,
            ...global.channelInfo,
          },
          { quoted: msg }
        );
      }

      const resposta = data.response || "Sem resposta.";
      const MAX = 6000;
      const textoFinal =
        resposta.length > MAX ? `${resposta.slice(0, MAX)}\n\n(Cortado...)` : resposta;

      await sock.sendMessage(
        from,
        { text: textoFinal, ...global.channelInfo },
        { quoted: msg }
      );
    } catch (e) {
      console.erro("gpt5 erro:", e?.message || e);
      await sock.sendMessage(
        from,
        { text: "❌ Erro ao conectar com a API de IA.", ...global.channelInfo },
        { quoted: msg }
      );
    }
  },
};
