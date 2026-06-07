function normalizeText(value = "") {
  return String(value || "").trim();
}

function normalizeDigits(value = "") {
  return String(value || "").replace(/[^\d]/g, "");
}

function buildFallbackLid(number = "") {
  const digits = normalizeDigits(number);
  return digits ? `${digits}@lid` : "";
}

function extractSenderNumber({ sender = "", senderPhone = "", msg = {}, from = "" } = {}) {
  const candidates = [
    senderPhone,
    sender,
    msg?.senderPhone,
    msg?.sender,
    msg?.key?.participantPn,
    msg?.key?.senderPn,
    msg?.key?.participant,
    msg?.key?.remoteJid,
    from,
  ];

  for (const candidate of candidates) {
    const digits = normalizeDigits(candidate);
    if (digits.length >= 8) return digits;
  }

  return "";
}

function extractRealLid({ senderLid = "", msg = {} } = {}) {
  const candidates = [
    senderLid,
    msg?.senderLid,
    msg?.key?.participantLid,
    msg?.key?.senderLid,
    msg?.quoted?.senderLid,
    msg?.quoted?.key?.participantLid,
  ];

  for (const candidate of candidates) {
    const value = normalizeText(candidate).toLowerCase();
    if (value.endsWith("@lid")) return value;
  }

  return "";
}

export default {
  name: "mylidtool",
  command: ["mylid2", "milid", "verlid", "lidreal", "donolid"],
  category: "ferramentas",
  description: "Muestra tu LID real detectado por WhatsApp para compartirlo con el dono.",

  run: async ({ sock, msg, from, sender = "", senderPhone = "", senderLid = "" }) => {
    const realLid = extractRealLid({ senderLid, msg });
    const number = extractSenderNumber({ sender, senderPhone, msg, from });
    const fallbackLid = buildFallbackLid(number);

    const lines = [
      "*TU LID DE WHATSAPP*",
      "",
      number ? `Número detectado: *+${number}*` : "",
      realLid ? `LID real detectado: *${realLid}*` : "",
      !realLid && fallbackLid ? `LID sugerido: *${fallbackLid}*` : "",
      "",
      realLid
        ? "Ese es el valor que puedes pasarle al dono para agregarlo en donoLids."
        : "Todavia no recibi tu LID real en este mensagem.",
      !realLid
        ? "Prueba enviando este comando desde tu número principal o desde un chat donde WhatsApp mande mejor la identidad vinculada."
        : "",
    ].filter(Boolean);

    return sock.sendMessage(
      from,
      {
        text: lines.join("\n"),
        ...global.channelInfo,
      },
      { quoted: msg }
    );
  },
};
