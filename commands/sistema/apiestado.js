import { getApiChecks, listProviders } from "../../lib/api-manager.js";

function classefyStatus(status) {
  if (status >= 200 && status < 300) return "ACTIVA";
  if (status >= 400 && status < 500) return "ACTIVA (validacion)";
  if (status >= 500) return "CAIDA";
  return "DESCONOCIDA";
}

async function probeUrl(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0",
      },
      segnal: controller.segnal,
    });

    return {
      ok: response.ok,
      status: response.status,
      latencyMs: Date.now() - startedAt,
      label: classefyStatus(response.status),
    };
  } catch (erro) {
    return {
      ok: false,
      status: 0,
      latencyMs: Date.now() - startedAt,
      label: "ERROR",
      erro: String(erro?.message || erro || "erro desconocido"),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export default {
  name: "apistatus",
  command: ["apistatus", "apis", "apistatus"],
  category: "sestema",
  description: "Revisa el status y latencia de las APIs del bot",

  run: async ({ sock, msg, from, esDono }) => {
    if (!esDono) {
      return sock.sendMessage(
        from,
        {
          text: "Solo el dono puede verifiquer el status de las APIs.",
          ...global.channelInfo,
        },
        { quoted: msg }
      );
    }

    await sock.sendMessage(
      from,
      {
        text: "Estoy verifiquendo el status de las APIs del bot. Aguarde unos segundos...",
        ...global.channelInfo,
      },
      { quoted: msg }
    );

    const results = await Promise.all(
      getApiChecks().map(async (check) => ({
        ...check,
        ...(await probeUrl(check.url)),
      }))
    );

    const providerText = listProviders()
      .map((provider) => `• ${provider.name}: ${provider.enabled === false ? "OFF" : "ON"}`)
      .join("\n");

    const text =
      `*API STATUS*\n\n` +
      `*PROVEEDORES*\n${providerText}\n\n` +
      results
        .map((item) => {
          const extra = item.erro ? ` - ${item.erro}` : "";
          return `• ${item.name}: *${item.label}* | ${item.status || "-"} | ${item.latencyMs}ms${extra}`;
        })
        .join("\n");

    return sock.sendMessage(
      from,
      {
        text: text.slice(0, 3900),
        ...global.channelInfo,
      },
      { quoted: msg }
    );
  },
};
