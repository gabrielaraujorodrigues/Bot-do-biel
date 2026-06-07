import axios from "axios";

const API_BASE = "https://dv-yer-api.online/ytmp3";
const API_KEY = "dvyer911840240197";

function isYouTubeUrl(url = "") {
  return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(url);
}

function pickAudioUrl(data) {
  return (
    data?.result?.url ||
    data?.result?.link ||
    data?.result?.download ||
    data?.result?.audio ||
    data?.url ||
    data?.link ||
    data?.download ||
    data?.audio ||
    null
  );
}

function pickTitle(data) {
  return (
    data?.result?.title ||
    data?.title ||
    "audio_youtube"
  );
}

let handler = async (m, { conn, text, usedPrefix, command }) => {
  try {
    if (!text) {
      return m.reply(
        `❌ Ingresa un enlace de YouTube.\n\n` +
        `Ejemplo:\n${usedPrefix + command} https://www.youtube.com/watch?v=dQw4w9WgXcQ`
      );
    }

    const url = text.trim();

    if (!isYouTubeUrl(url)) {
      return m.reply("❌ El enlace no parece ser de YouTube.");
    }

    await m.reply("⏳ Downloadndo audio, espera un momento...");

    const apiUrl =
      `${API_BASE}?mode=link` +
      `&url=${encodeURIComponent(url)}` +
      `&apikey=${encodeURIComponent(API_KEY)}`;

    const { data } = await axios.get(apiUrl, {
      timeout: 30000,
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    const audioUrl = pickAudioUrl(data);
    const title = pickTitle(data);

    if (!audioUrl) {
      console.log("Resposta API ytmp3:", data);
      return m.reply("❌ No se pudo obtener el enlace del audio desde la API.");
    }

    const cleanTitle = String(title)
      .replace(/[\\/:*?"<>|]/g, "")
      .slice(0, 80);

    await conn.sendMessage(
      m.chat,
      {
        audio: { url: audioUrl },
        mimetype: "audio/mpeg",
        fileName: `${cleanTitle}.mp3`,
        ptt: false,
      },
      { quoted: m }
    );

  } catch (erro) {
    console.erro("Erro ytmp3:", erro?.response?.data || erro);

    const msg =
      erro?.code === "ECONNABORTED"
        ? "❌ La API tardó demais en responder."
        : "❌ Ocurrió un erro al downloadr el audio.";

    await m.reply(msg);
  }
};

handler.help = ["ytmp3 <url>"];
handler.tags = ["downloads"];
handler.command = ["ytmp5"];

export default handler;