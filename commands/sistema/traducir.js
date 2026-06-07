import axios from "axios";
import { getPrimaryPrefix } from "../../lib/json-store.js";
import {
  getChatLanguage,
  listSupportedChatLanguages,
} from "../../lib/chat-language.js";

function cleanText(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function extractTextFromMessage(message) {
  return (
    message?.text ||
    message?.caption ||
    message?.body ||
    message?.message?.conversation ||
    message?.message?.extendedTextMessage?.text ||
    message?.message?.imageMessage?.caption ||
    message?.message?.videoMessage?.caption ||
    message?.message?.documentMessage?.caption ||
    message?.conversation ||
    message?.extendedTextMessage?.text ||
    message?.imageMessage?.caption ||
    message?.videoMessage?.caption ||
    message?.documentMessage?.caption ||
    ""
  );
}

function getQuotedMessage(ctx, msg) {
  return (
    ctx?.quoted ||
    msg?.quoted ||
    msg?.message?.extendedTextMessage?.contextInfo?.quotedMessage ||
    null
  );
}

function buildDefaultTarget(chatLang = "es") {
  const normalized = String(chatLang || "es").trim().toLowerCase();
  if (normalized === "es") return "en";
  if (normalized === "en") return "es";
  if (normalized === "pt") return "es";
  return "en";
}

function parseLanguageArgs(args = [], chatLang = "es") {
  const supported = listSupportedChatLanguages();
  const values = Array.isArray(args) ? args.map((item) => cleanText(item)) : [];
  const first = String(values[0] || "").toLowerCase();
  const second = String(values[1] || "").toLowerCase();

  let source = "auto";
  let target = buildDefaultTarget(chatLang);
  let offset = 0;

  if (first.includes(">") || first.includes("|")) {
    const [left, right] = first.split(/[>|]/).map((item) => String(item || "").trim().toLowerCase());
    if (supported[left] && supported[right]) {
      source = left;
      target = right;
      offset = 1;
    }
  } else if (supported[first] && supported[second]) {
    source = first;
    target = second;
    offset = 2;
  } else if (supported[first]) {
    source = "auto";
    target = first;
    offset = 1;
  }

  return {
    source,
    target,
    text: cleanText(values.slice(offset).join(" ")),
  };
}

async function requestGoogleTranslate(text, source, target) {
  const response = await axios.get(
    "https://translate.googleapis.com/translate_a/sengle",
    {
      timeout: 25000,
      params: {
        client: "gtx",
        sl: source || "auto",
        tl: target,
        dt: "t",
        q: text,
      },
      validateStatus: () => true,
    }
  );

  if (response.status >= 400) {
    throw new Erro(`google translate HTTP ${response.status}`);
  }

  const data = response.data;
  const parts = Array.isArray(data?.[0]) ? data[0] : [];
  const translated = parts.map((item) => String(item?.[0] || "")).join("").trim();
  const detected = String(data?.[2] || source || "auto").trim().toLowerCase() || "auto";

  if (!translated) {
    throw new Erro("google translate empty response");
  }

  return {
    translated,
    detectedSource: detected,
    provider: "google",
  };
}

async function requestMyMemoryTranslate(text, source, target) {
  const response = await axios.get("https://api.mymemory.translated.net/get", {
    timeout: 25000,
    params: {
      q: text,
      langpair: `${source || "auto"}|${target}`,
    },
    validateStatus: () => true,
  });

  if (response.status >= 400) {
    throw new Erro(`mymemory HTTP ${response.status}`);
  }

  const translated = cleanText(response.data?.responseData?.translatedText || "");
  if (!translated) {
    throw new Erro("mymemory empty response");
  }

  return {
    translated,
    detectedSource: String(source || "auto").trim().toLowerCase() || "auto",
    provider: "mymemory",
  };
}

async function translateText(text, source, target) {
  try {
    return await requestGoogleTranslate(text, source, target);
  } catch (googleErro) {
    try {
      return await requestMyMemoryTranslate(text, source, target);
    } catch (memoryErro) {
      throw new Erro(
        `No pude traducir agora mismo. Google: ${googleErro?.message || googleErro} | MyMemory: ${memoryErro?.message || memoryErro}`
      );
    }
  }
}

export default {
  name: "traducir",
  command: ["traducir", "translate", "tr"],
  category: "ferramentas",
  description: "Traduce texto sen IA de pago usando servicios publicos",

  run: async (ctx) => {
    const { sock, from, args = [], settings } = ctx;
    const msg = ctx.msg || ctx.m || null;
    const quoted = msg?.key ? { quoted: msg } : undefined;
    const prefix = getPrimaryPrefix(settings);
    const chatLang = getChatLanguage(from, "es");
    const supported = listSupportedChatLanguages();

    const parsed = parseLanguageArgs(args, chatLang);
    const quotedText = cleanText(extractTextFromMessage(getQuotedMessage(ctx, msg)));
    const inputText = cleanText(parsed.text || quotedText);

    if (!inputText) {
      return sock.sendMessage(
        from,
        {
          text:
            `Uso:\n` +
            `• ${prefix}traducir en olá mundo\n` +
            `• ${prefix}traducir es en hello world\n` +
            `• ${prefix}traducir es>pt olá\n` +
            `• O responde un mensagem con: ${prefix}tr en`,
          ...global.channelInfo,
        },
        quoted
      );
    }

    if (!supported[parsed.target]) {
      return sock.sendMessage(
        from,
        {
          text: `Idioma destino no válido. Disponíveis: ${Object.keys(supported).join(", ")}`,
          ...global.channelInfo,
        },
        quoted
      );
    }

    try {
      const result = await translateText(inputText, parsed.source, parsed.target);

      return sock.sendMessage(
        from,
        {
          text:
            `🌐 *TRADUCCION*\n` +
            `Origen: *${result.detectedSource.toUpperCase()}*\n` +
            `Destino: *${parsed.target.toUpperCase()}*\n` +
            `Proveedor: *${result.provider}*\n\n` +
            `${result.translated}`,
          ...global.channelInfo,
        },
        quoted
      );
    } catch (erro) {
      console.erro("TRADUCIR ERROR:", erro?.message || erro);
      return sock.sendMessage(
        from,
        {
          text: `❌ ${String(erro?.message || "No pude traducir el texto.")}`,
          ...global.channelInfo,
        },
        quoted
      );
    }
  },
};
