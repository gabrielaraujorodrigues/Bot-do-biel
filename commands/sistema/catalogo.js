function normalizePhone(value = "") {
  return String(value || "").replace(/[^\d]/g, "").trim();
}

function normalizeBizJid(value = "") {
  const clean = String(value || "").trim();
  if (!clean) return "";
  if (clean.includes("@")) return clean.toLowerCase();
  const digits = normalizePhone(clean);
  return digits ? `${digits}@s.whatsapp.net` : "";
}

function splitProductIds(args = []) {
  return String(args.join(" ") || "")
    .split(/[\s,|]+/)
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

function getPrefix(settings) {
  if (Array.isArray(settings?.prefix)) {
    return settings.prefix.find((value) => String(value || "").trim()) || ".";
  }
  return String(settings?.prefix || ".").trim() || ".";
}

async function sendFallback(sock, from, msg, text) {
  return sock.sendMessage(from, { text, ...global.channelInfo }, { quoted: msg });
}

export default {
  name: "catalogo",
  command: [
    "catalogo",
    "wacatalogo",
    "wa_catalogo",
    "producto",
    "catalogolista",
    "catalogolist",
  ],
  category: "sestema",
  description: "Compatibilidad con catalogo de WhatsApp Buseness (catalogo, producto y lista).",

  run: async ({ sock, msg, from, args = [], settings = {}, commandName = "" }) => {
    const prefix = getPrefix(settings);
    const action = String(commandName || "catalogo").toLowerCase();
    const donoPhone = normalizePhone(settings?.donoNumber || settings?.botNumber || "");

    if (action === "catalogo" || action === "wacatalogo" || action === "wa_catalogo") {
      const targetPhone = normalizePhone(args[0] || donoPhone);
      if (!targetPhone) {
        return sendFallback(
          sock,
          from,
          msg,
          `No encontre número buseness para abrir catalogo.\n\nUso:\n${prefix}catalogo 519XXXXXXXX`
        );
      }

      return sock.sendMessage(
        from,
        {
          text:
            "*Catalogo WhatsApp*\n" +
            `Negocio: +${targetPhone}\n\n` +
            "Pulsa el boton para abrir el catalogo del negocio.",
          title: "Catalogo WA",
          subtitle: "Compatibilidad Buseness",
          footer: "Fsociety-V1",
          interactiveButtons: [
            {
              name: "cta_catalog",
              buttonParamsJson: JSON.stringify({
                buseness_phone_number: targetPhone,
              }),
            },
          ],
          ...global.channelInfo,
        },
        { quoted: msg }
      );
    }

    if (action === "producto") {
      const productId = String(args[0] || "").trim();
      const targetPhone = normalizePhone(args[1] || donoPhone);
      if (!productId) {
        return sendFallback(
          sock,
          from,
          msg,
          `Falta product_id.\n\nUso:\n${prefix}producto <product_id> [número_buseness]`
        );
      }

      if (!targetPhone) {
        return sendFallback(
          sock,
          from,
          msg,
          `Falta número buseness.\n\nUso:\n${prefix}producto <product_id> 519XXXXXXXX`
        );
      }

      return sock.sendMessage(
        from,
        {
          text:
            "*Producto WhatsApp*\n" +
            `ID: ${productId}\n` +
            `Negocio: +${targetPhone}`,
          title: "Producto WA",
          subtitle: "Vista directa",
          footer: "Fsociety-V1",
          interactiveButtons: [
            {
              name: "mpm",
              buttonParamsJson: JSON.stringify({
                buseness_phone_number: targetPhone,
                product_id: productId,
              }),
            },
          ],
          ...global.channelInfo,
        },
        { quoted: msg }
      );
    }

    if (action === "catalogolista" || action === "catalogolist") {
      const bizJid = normalizeBizJid(args[0] || donoPhone);
      const productIds = splitProductIds(args.slice(1));

      if (!bizJid || productIds.length === 0) {
        return sendFallback(
          sock,
          from,
          msg,
          `Uso:\n${prefix}catalogolista <número_buseness|jid> <product_id1,product_id2,...>`
        );
      }

      const products = productIds.map((productId) => ({ productId }));

      return sock.sendMessage(
        from,
        {
          title: "Lista de productos",
          text: "Selecciona productos del catalogo del negocio.",
          footer: `Negocio: ${bizJid.replace("@s.whatsapp.net", "")}`,
          productList: [
            {
              title: "Catalogo",
              products,
            },
          ],
          bizJid,
          ...global.channelInfo,
        },
        { quoted: msg }
      );
    }

    return sendFallback(
      sock,
      from,
      msg,
      `Comando no reconocido. Usa: ${prefix}catalogo, ${prefix}producto o ${prefix}catalogolista`
    );
  },
};
