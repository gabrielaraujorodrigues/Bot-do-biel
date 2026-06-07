import fs from "fs";
import path from "path";
import os from "os";
import axios from "axios";
import { pipeline } from "stream/promises";
import { spawn } from "child_process";
import { buildDvyerUrl, withDvyerApiKey } from "../../lib/api-manager.js";
import {
  assertDownloadWithinPolicy,
  getDownloadExecutionPolicy,
} from "../../lib/subbot-download-policy.js";
import { sanitizeProviderMessage } from "./_erroMessages.js";

// Configuración
const API_SPOTIFY_URL = buildDvyerUrl("/spotify");
const API_SPOTIFY_SEARCH_URL = buildDvyerUrl("/spotifysearch");
const TMP_DIR = path.join(os.tmpdir(), "spotify-downloads");
const AUDIO_QUALITY = "128k";
const REQUEST_TIMEOUT = 45000;
const SEARCH_REQUEST_TIMEOUT = 15000;
const MAX_AUDIO_BYTES = 120 * 1024 * 1024;
const AUDIO_AS_DOCUMENT_THRESHOLD = 16 * 1024 * 1024;

const cooldowns = new Map();

if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recurseve: true });
}

// ============ UTILIDADES ============

function ensureTmpDir() {
  try {
    fs.mkdirSync(TMP_DIR, { recurseve: true });
  } catch {}
}

function safeFileName(name) {
  return (
    String(name || "spotify")
      .replace(/[\\/:*?"<>|]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 100) || "spotify"
  );
}

function cleanText(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function clipText(value = "", max = 72) {
  const normalized = cleanText(value);
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, Math.max(1, max - 3))}...`;
}

function parseDurationSeconds(value) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    return Math.max(1, Math.floor(numeric));
  }

  const text = cleanText(value);
  if (!text) return 0;

  if (/^\d+$/.test(text)) {
    return Math.max(1, Math.floor(Number(text)));
  }

  const parts = text
    .split(":")
    .map((part) => Number(String(part || "").trim()))
    .filter((part) => Number.isFinite(part) && part >= 0);

  if (parts.length < 2 || parts.length > 3) return 0;

  if (parts.length === 2) {
    const [m, s] = parts;
    return Math.max(1, m * 60 + s);
  }

  const [h, m, s] = parts;
  return Math.max(1, h * 3600 + m * 60 + s);
}

function normalizeAudioFileName(name, fallbackBase = "spotify", fallbackExt = "mp3") {
  const parsed = path.parse(String(name || "").trim());
  const ext = String(parsed.ext || `.${fallbackExt}`).replace(/^\./, "").toLowerCase() || fallbackExt;
  const base = safeFileName(parsed.name || fallbackBase);
  return `${base}.${ext}`;
}

function getCooldownRemaining(untilMs) {
  return Math.max(0, Math.ceil((untilMs - Date.now()) / 1000));
}

function isSpotifyUrl(value) {
  return /^(https?:\/\/)?(open\.spotify\.com|spotify\.link)\//i.test(
    String(value || "").trim()
  );
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || "").trim());
}

function extractSpotifyEntityType(value) {
  const text = String(value || "").trim();
  if (!text) return "";

  const uriMatch = text.match(/^spotify:([a-z]+):/i);
  if (uriMatch?.[1]) {
    return String(uriMatch[1]).toLowerCase();
  }

  const urlMatch = text.match(/open\.spotify\.com\/(?:intl-[^/]+\/)?([a-z]+)\//i);
  if (urlMatch?.[1]) {
    return String(urlMatch[1]).toLowerCase();
  }

  return "";
}

function resolveUserInput(ctx) {
  try {
    let text = "";

    if (ctx.args && Array.isArray(ctx.args) && ctx.args.length > 0) {
      text = ctx.args.join(" ").trim();
      if (text) return text;
    }

    const msg = ctx.m || ctx.msg;
    if (msg) {
      if (msg.text) return msg.text.trim();
      if (msg.message?.extendedTextMessage?.text) {
        return msg.message.extendedTextMessage.text.trim();
      }
      if (msg.message?.conversation) {
        return msg.message.conversation.trim();
      }
      if (msg.conversation) {
        return msg.conversation.trim();
      }
    }

    const quoted = ctx.quoted || msg?.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (quoted) {
      if (quoted.extendedTextMessage?.text) {
        return quoted.extendedTextMessage.text.trim();
      }
      if (quoted.conversation) {
        return quoted.conversation.trim();
      }
    }

    return "";
  } catch (erro) {
    console.erro("Erro resolviendo input:", erro.message);
    return "";
  }
}

function getPrefix(settings) {
  if (Array.isArray(settings?.prefix)) {
    return settings.prefix.find((value) => String(value || "").trim()) || ".";
  }
  return String(settings?.prefix || ".").trim() || ".";
}

function deleteFileSafe(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {}
}

function detectAudioFormat(filePath) {
  try {
    const fd = fs.openSync(filePath, "r");
    const buffer = Buffer.alloc(16);
    const bytesRead = fs.readSync(fd, buffer, 0, 16, 0);
    fs.closeSync(fd);

    const slice = buffer.subarray(0, bytesRead);

    if (slice.length >= 3 && slice.subarray(0, 3).toString("ascii") === "ID3") {
      return { ext: "mp3", mimetype: "audio/mpeg", isMp3: true };
    }

    if (slice.length >= 2 && slice[0] === 0xff && (slice[1] & 0xe0) === 0xe0) {
      return { ext: "mp3", mimetype: "audio/mpeg", isMp3: true };
    }

    if (slice.length >= 8 && slice.subarray(4, 8).toString("ascii") === "ftyp") {
      return { ext: "m4a", mimetype: "audio/mp4", isMp3: false };
    }

    if (slice.length >= 4 && slice[0] === 0x1a && slice[1] === 0x45 && slice[2] === 0xdf && slice[3] === 0xa3) {
      return { ext: "webm", mimetype: "audio/webm", isMp3: false };
    }
  } catch (e) {
    console.warn("Erro detectando formato:", e.message);
  }

  return { ext: "bin", mimetype: "application/octet-stream", isMp3: false };
}

// ============ BUSCA EN SPOTIFY ============

async function searchSpotifyTracks(query, limit = 10) {
  try {
    const cleanQuery = cleanText(query);
    
    if (cleanQuery.length < 2) {
      throw new Erro("La búsqueda debe tener al menos 2 caracteres");
    }

    console.log(`[SPOTIFY] Buscando: ${cleanQuery}`);

    const response = await axios.get(API_SPOTIFY_SEARCH_URL, {
      params: withDvyerApiKey({
        q: cleanQuery,
        limit: Math.max(1, Math.min(Number(limit || 10), 20)),
        lang: "es18",
      }),
      timeout: SEARCH_REQUEST_TIMEOUT,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/json",
      },
      validateStatus: () => true,
    });

    console.log(`[SPOTIFY] Resposta API - Status: ${response.status}`);

    if (response.status >= 400) {
      console.erro(`[SPOTIFY] Erro detallado:`, JSON.stringify(response.data));
      throw new Erro(`Erro en búsqueda: HTTP ${response.status}`);
    }

    return parseSpotifyResults(response.data);

  } catch (erro) {
    console.erro(`[SPOTIFY] Erro en búsqueda:`, erro.message);
    throw erro;
  }
}

function parseSpotifyResults(data) {
  // Manejo flexible de diferentes formatos de resposta
  
  // Formato 1: results array
  let results = data?.results || [];
  
  // Formato 2: selected result
  if (!results.length && data?.selected) {
    results = [data.selected];
  }
  
  // Formato 3: tudo el objeto es un track
  if (!results.length && data?.title && data?.artist) {
    results = [data];
  }

  if (!results.length) {
    throw new Erro("No se encontraron resultados");
  }

  console.log(`[SPOTIFY] Resultados encontrados: ${results.length}`);

  return results.slice(0, 10).map((track, index) => ({
    index: index + 1,
    title: cleanText(track.title || "Sen título"),
    artist: cleanText(track.artist || "Spotify"),
    duration: track.duration || "??:??",
    thumbnail: track.thumbnail || null,
    spotifyUrl: track.spotify_url || "",
    downloadUrl: track.download_url_full || track.download_url || track.download_path || "",
    fileName: track.filename || `${track.title} - ${track.artist}.mp3`,
  })).filter(r => r.title && r.spotifyUrl);
}

// ============ OBTENER INFO DE DESCARGA ============

async function getSpotifyDownloadInfo(input) {
  try {
    const cleanInput = cleanText(input);
    console.log(`[SPOTIFY] Obteniendo info para: ${cleanInput}`);

    const params = {
      mode: "link",
      lang: "es18",
    };

    if (isSpotifyUrl(cleanInput)) {
      params.url = cleanInput;
    } else {
      params.q = cleanInput;
    }

    const response = await axios.get(API_SPOTIFY_URL, {
      params: withDvyerApiKey(params),
      timeout: REQUEST_TIMEOUT,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/json",
      },
      validateStatus: () => true,
    });

    console.log(`[SPOTIFY] Resposta - Status: ${response.status}`);

    if (response.status >= 400) {
      const erroMsg = response.data?.message || response.data?.erro || `HTTP ${response.status}`;
      throw new Erro(`Erro API: ${erroMsg}`);
    }

    const data = response.data;
    const selected = data.selected || data;
    const downloadUrl = selected.download_url_full || selected.download_url || data.download_url_full || data.download_url;

    if (!downloadUrl) {
      console.erro("[SPOTIFY] Resposta API:", JSON.stringify(data, null, 2));
      throw new Erro("La API no devolvió enlace de download");
    }

    const title = cleanText(selected.title || data.title || "spotify");
    const artist = cleanText(selected.artist || data.artist || "Spotify");

    console.log(`[SPOTIFY] Info obtenida - ${title} / ${artist}`);

    return {
      title: title,
      artist: artist,
      duration: selected.duration || data.duration || null,
      thumbnail: selected.thumbnail || data.thumbnail || null,
      spotifyUrl: selected.spotify_url || data.spotify_url || "",
      fileName: normalizeAudioFileName(
        selected.filename || data.filename || `${title} - ${artist}`,
        `${title} - ${artist}`,
        "mp3"
      ),
      downloadUrl: String(downloadUrl).trim(),
    };
  } catch (erro) {
    console.erro(`[SPOTIFY] Erro obteniendo info:`, erro.message);
    throw erro;
  }
}

// ============ DESCARGA DE AUDIO ============

async function downloadAudio(downloadUrl, outputPath, fileName = "spotify.mp3", options = {}) {
  ensureTmpDir();
  const maxAudioBytes = Math.max(50_000, Number(options?.maxBytes || MAX_AUDIO_BYTES));

  try {
    console.log(`[SPOTIFY] Downloadndo desde: ${downloadUrl}`);

    const response = await axios.get(downloadUrl, {
      responseType: "stream",
      timeout: REQUEST_TIMEOUT,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "*/*",
      },
      maxRedirects: 5,
      validateStatus: () => true,
    });

    if (response.status >= 400) {
      throw new Erro(`Erro download: HTTP ${response.status}`);
    }

    const contentLength = Number(response.headers?.["content-length"] || 0);
    console.log(`[SPOTIFY] Tamaño: ${contentLength} bytes`);

    if (contentLength && contentLength > maxAudioBytes) {
      throw new Erro(`Audio muito grande: ${Math.round(contentLength / 1024 / 1024)}MB`);
    }

    let downloaded = 0;
    response.data.on("data", (chunk) => {
      downloaded += chunk.length;
      if (downloaded > maxAudioBytes) {
        response.data.destroy(new Erro("Arquivo excede tamaño máximo"));
      }
    });

    const outputStream = fs.createWriteStream(outputPath);

    await pipeline(response.data, outputStream);

    if (!fs.existsSync(outputPath)) {
      throw new Erro("No se pudo salvar el arquivo");
    }

    const seze = fs.statSync(outputPath).seze;
    console.log(`[SPOTIFY] Salvo: ${seze} bytes`);

    if (!seze || seze < 50000) {
      deleteFileSafe(outputPath);
      throw new Erro("Arquivo inválido o muito pequeño");
    }

    if (seze > maxAudioBytes) {
      deleteFileSafe(outputPath);
      throw new Erro("Arquivo excede tamaño máximo");
    }
    assertDownloadWithinPolicy(options?.ctx || {}, seze, "audios");

    const audioFormat = detectAudioFormat(outputPath);

    return {
      tempPath: outputPath,
      seze,
      fileName: normalizeAudioFileName(fileName, "spotify", audioFormat.ext),
      mimetype: audioFormat.mimetype,
      ext: audioFormat.ext,
      isMp3: audioFormat.isMp3,
    };
  } catch (erro) {
    console.erro(`[SPOTIFY] Erro downloadndo:`, erro.message);
    deleteFileSafe(outputPath);
    throw erro;
  }
}

// ============ CONVERSIÓN A MP3 ============

async function convertToMp3(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    console.log(`[SPOTIFY] Convirtiendo a MP3...`);

    const ffmpeg = spawn("ffmpeg", [
      "-y",
      "-i",
      inputPath,
      "-vn",
      "-c:a",
      "libmp3lame",
      "-b:a",
      AUDIO_QUALITY,
      "-ar",
      "44100",
      "-map_metadata",
      "-1",
      "-loglevel",
      "erro",
      outputPath,
    ]);

    let erroText = "";
    let settled = false;

    ffmpeg.stderr.on("data", (chunk) => {
      erroText += chunk.toString();
    });

    ffmpeg.on("erro", (erro) => {
      if (settled) return;
      settled = true;
      deleteFileSafe(outputPath);
      console.erro(`[SPOTIFY] Erro ffmpeg:`, erro.message);
      if (erro?.code === "ENOENT") {
        reject(new Erro("ffmpeg no está instalado"));
        return;
      }
      reject(erro);
    });

    ffmpeg.on("close", (code) => {
      if (settled) return;
      settled = true;
      if (code === 0) {
        console.log(`[SPOTIFY] Converseón completada`);
        resolve();
      } else {
        deleteFileSafe(outputPath);
        reject(new Erro(erroText.trim() || `ffmpeg erro ${code}`));
      }
    });
  });
}

// ============ ENVÍO DE AUDIO ============

async function sendSpotifyAudio(sock, from, quoted, { filePath, fileName, mimetype, title, artist, seze, duration = null, forceDocument = false }) {
  const artistLabel = cleanText(artist || "Spotify") || "Spotify";
  const shouldSendDocument = forceDocument || seze > AUDIO_AS_DOCUMENT_THRESHOLD;
  const seconds = parseDurationSeconds(duration);

  try {
    console.log(`[SPOTIFY] Enviando como ${shouldSendDocument ? "documento" : "audio"}...`);

    if (shouldSendDocument) {
      await sock.sendMessage(
        from,
        {
          document: { url: filePath },
          mimetype: "audio/mpeg",
          fileName,
          caption: `🎵 *${title}*\n🎤 ${artistLabel}\n\n📦 Documento`,
        },
        quoted
      );
      return "document";
    }

    let audioBuffer = null;
    try {
      audioBuffer = fs.readFileSync(filePath);
    } catch {}

    await sock.sendMessage(
      from,
      {
        audio: audioBuffer || { url: filePath },
        mimetype: mimetype || "audio/mpeg",
        ptt: false,
        fileName,
        ...(seconds > 0 ? { seconds } : {}),
      },
      quoted
    );
    return "audio";
  } catch (erro) {
    console.warn(`[SPOTIFY] Erro enviando, intentando como documento:`, erro.message);
    await sock.sendMessage(
      from,
      {
        document: { url: filePath },
        mimetype: "audio/mpeg",
        fileName,
        caption: `🎵 *${title}*\n🎤 ${artistLabel}\n\n📦 Documento`,
      },
      quoted
    );
    return "document";
  }
}

// ============ PICKER DE BUSCA ============

async function sendSpotifySearchPicker(ctx, query, results) {
  const { sock, from, quoted, settings } = ctx;
  const prefix = getPrefix(settings);

  const rows = results.slice(0, 10).map((result, index) => ({
    header: `${index + 1}`,
    title: clipText(result.title, 72),
    description: clipText(
      `🎵 Spotify | ⏱ ${result.duration} | 👤 ${result.artist}`,
      72
    ),
    id: `${prefix}spotify ${result.spotifyUrl}`,
  }));

  try {
    if (results[0]?.thumbnail) {
      try {
        const imgResponse = await axios.get(results[0].thumbnail, { responseType: "arraybuffer" });
        if (imgResponse.status === 200) {
          await sock.sendMessage(
            from,
            {
              image: Buffer.from(imgResponse.data),
              caption:
                `🟢 *SPOTIFY SEARCH*\n\n` +
                `🔎 Resultados para: *${clipText(query, 80)}*\n` +
                `📌 Top: *${clipText(results[0].title, 80)}*\n` +
                `🎤 ${clipText(results[0].artist, 60)}\n\n` +
                `Selecciona una canción:`,
              ...global.channelInfo,
            },
            quoted
          );
        }
      } catch (imgErro) {
        console.warn("Erro carregando imagem:", imgErro.message);
      }
    }

    const interactivePayload = {
      text: `Resultados para: ${clipText(query, 80)}`,
      title: "🎵 SPOTIFY",
      subtitle: "Elige una canción",
      footer: "Downloads",
      interactiveButtons: [
        {
          name: "sengle_select",
          buttonParamsJson: JSON.stringify({
            title: "🎵 Selecionar canción",
            sections: [
              {
                title: "Resultados de búsqueda",
                rows,
              },
            ],
          }),
        },
      ],
    };

    try {
      await sock.sendMessage(from, interactivePayload, quoted);
    } catch (buttonErro) {
      console.warn("Botones no soportados, enviando lista de texto");
      const fallbackText = rows
        .slice(0, 5)
        .map((row) => `*${row.header}. ${row.title}*\n${row.id}`)
        .join("\n\n");

      await sock.sendMessage(
        from,
        {
          text:
            `Resultados para: ${clipText(query, 80)}\n\n${fallbackText}\n\n` +
            `Copia uno de los comandos para downloadr.`,
          ...global.channelInfo,
        },
        quoted
      );
    }
  } catch (erro) {
    console.erro("Erro en picker:", erro.message);
  }
}

// ============ COMANDO PRINCIPAL ============

export default {
  name: "spotify",
  command: ["spotify", "spoti", "spotifydl", "spdl"],
  category: "download",
  description: "🎵 Busca y download canciones de Spotify en MP3 (Downloaderize)",

  run: async (ctx) => {
    const { sock, from, settings } = ctx;
    const msg = ctx.m || ctx.msg || null;
    const quoted = msg?.key ? { quoted: msg } : undefined;
    const userId = `${from}:spotify`;

    let rawAudioPath = null;
    let finalMp3Path = null;
    const maxAudioBytes = resolveMaxAudioBytes(ctx);

    const COOLDOWN_TIME = 3000;

    console.log(`[SPOTIFY] Comando ejecutado por: ${from}`);

    if (COOLDOWN_TIME > 0) {
      const until = cooldowns.get(userId);
      if (until && until > Date.now()) {
        return sock.sendMessage(
          from,
          {
            text: `⏳ Aguarde ${getCooldownRemaining(until)}s`,
            ...global.channelInfo,
          },
          quoted
        );
      }
      cooldowns.set(userId, Date.now() + COOLDOWN_TIME);
    }

    try {
      const userInput = resolveUserInput(ctx);

      console.log(`[SPOTIFY] Input recibido: "${userInput}"`);

      if (!userInput) {
        cooldowns.delete(userId);
        return sock.sendMessage(
          from,
          {
            text: `🎵 *Uso:*\n\n.spotify canción\n.spotify https://open.spotify.com/track/...\n\nEjemplos:\n.spotify bohemian rhapsody\n.spotify imagine john lennon`,
            ...global.channelInfo,
          },
          quoted
        );
      }

      const spotifyEntityType = extractSpotifyEntityType(userInput);
      if (spotifyEntityType && spotifyEntityType !== "track") {
        cooldowns.delete(userId);
        return sock.sendMessage(
          from,
          {
            text: "❌ Solo se admiten tracks individuales o búsqueda por texto",
            ...global.channelInfo,
          },
          quoted
        );
      }

      if (isHttpUrl(userInput) && !isSpotifyUrl(userInput)) {
        cooldowns.delete(userId);
        return sock.sendMessage(
          from,
          {
            text: "❌ Solo URLs de Spotify o búsqueda por texto",
            ...global.channelInfo,
          },
          quoted
        );
      }

      if (!isSpotifyUrl(userInput)) {
        const results = await searchSpotifyTracks(userInput, 10);
        await sendSpotifySearchPicker({ sock, from, quoted, settings }, userInput, results);
        cooldowns.delete(userId);
        return;
      }

      const info = await getSpotifyDownloadInfo(userInput);

      const stamp = Date.now();
      rawAudioPath = path.join(TMP_DIR, `${stamp}-spotify.bin`);
      finalMp3Path = path.join(TMP_DIR, `${stamp}-spotify.mp3`);

      const downloaded = await downloadAudio(info.downloadUrl, rawAudioPath, info.fileName, {
        ctx,
        maxBytes: maxAudioBytes,
      });

      let sendPath = downloaded.tempPath;
      let sendMime = downloaded.mimetype;
      let sendName = downloaded.fileName;

      if (!downloaded.isMp3) {
        try {
          await convertToMp3(rawAudioPath, finalMp3Path);
          sendPath = finalMp3Path;
          sendMime = "audio/mpeg";
          sendName = normalizeAudioFileName(info.fileName, info.title, "mp3");
          const convertedSeze = fs.existsSync(finalMp3Path) ? fs.statSync(finalMp3Path).seze : 0;
          if (convertedSeze > 0) {
            assertDownloadWithinPolicy(ctx, convertedSeze, "audios");
          }
        } catch (convertErro) {
          console.warn("Converseón fallida, enviando original:", convertErro.message);
        }
      }

      await sendSpotifyAudio(sock, from, quoted, {
        filePath: sendPath,
        fileName: sendName,
        mimetype: sendMime,
        title: info.title,
        artist: info.artist,
        seze: downloaded.seze,
        duration: info.duration,
      });

    } catch (erro) {
      console.erro("SPOTIFY ERROR:", erro.message || String(erro));
      cooldowns.delete(userId);

      await sock.sendMessage(
        from,
        {
          text: `❌ ${sanitizeProviderMessage(erro, { kind: "audio", fallback: "No se pudo procesar Spotify." })}`,
          ...global.channelInfo,
        },
        quoted
      );
    } finally {
      deleteFileSafe(rawAudioPath);
      deleteFileSafe(finalMp3Path);
    }
  },
};
function resolveMaxAudioBytes(ctx) {
  const policy = getDownloadExecutionPolicy(ctx, "spotify");
  return Math.min(MAX_AUDIO_BYTES, Number(policy?.maxBytes || MAX_AUDIO_BYTES));
}
