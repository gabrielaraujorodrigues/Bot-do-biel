function normalizarJid(x) {
  const jid = String(x || "").trim();
  if (!jid) return "";
  const [user] = jid.split("@");
  return user.split(":")[0];
}

function normalizarNúmero(x) {
  return normalizarJid(x).replace(/[^\d]/g, "").trim();
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

export default {
  name: "whoami",
  command: ["whoami"],
  category: "admin",

  run: async ({ sock, msg, from, settings }) => {
    const senderJid =
      msg?.key?.participant || msg?.participant || msg?.key?.remoteJid || from;
    const senderIds = unique([normalizarJid(senderJid), normalizarNúmero(senderJid)]);
    const donoNumbers = Array.isArray(settings?.donoNumbers) ? settings.donoNumbers : [];
    const donoLids = Array.isArray(settings?.donoLids) ? settings.donoLids : [];
    const donosNorm = unique([
      ...donoNumbers.map(normalizarNúmero),
      ...donoLids.map(normalizarJid),
      ...donoLids.map(normalizarNúmero),
    ]);
    const isDono = senderIds.some((value) => donosNorm.includes(value));

    await sock.sendMessage(
      from,
      {
        text:
          `*WHOAMI*\n\n` +
          `senderJid: ${String(senderJid)}\n` +
          `senderIds: ${JSON.stringify(senderIds)}\n\n` +
          `donoNumbers: ${JSON.stringify(donoNumbers)}\n` +
          `donoLids: ${JSON.stringify(donoLids)}\n` +
          `donosNorm: ${JSON.stringify(donosNorm)}\n\n` +
          `esDono: ${isDono}`,
        ...global.channelInfo,
      },
      { quoted: msg }
    );
  },
};
