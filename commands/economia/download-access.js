import {
  consumeDownloadRequest,
  formatCoins,
  getDownloadRequestState,
  getEconomyConfig,
  getPrefix,
  refundDownloadRequest,
} from "./_shared.js";

function buildBlockedMessage(settings, state) {
  const prefix = getPrefix(settings);
  const requestPrice = formatCoins(state?.requestPrice || getEconomyConfig(settings).requestPrice);

  return (
    `*SOLICITUDES AGOTADAS*\n\n` +
    `Tus solicitações de downloads de hoy ya se terminaron.\n\n` +
    `Grátis por dia: *${state?.dailyLimit || 0}*\n` +
    `Usadas hoy: *${state?.dailyUsed || 0}*\n` +
    `Extras disponíveis: *${state?.extraRemaining || 0}*\n` +
    `Precio por solicitação: *${requestPrice}*\n\n` +
    `Compra mas con *${prefix}buyrequests 5* o verifique *${prefix}solicitações*.`
  );
}

export async function chargeDownloadRequest(ctx, meta = {}) {
  const { sock, from, msg, sender, settings, esDono } = ctx;

  if (esDono) {
    return {
      ok: true,
      charged: false,
      bypass: "dono",
      requests: getDownloadRequestState(sender, settings),
    };
  }

  const config = getEconomyConfig(settings);
  if (!config.downloadBillingEnabled) {
    return {
      ok: true,
      charged: false,
      bypass: "disabled",
      requests: getDownloadRequestState(sender, settings),
    };
  }

  const result = consumeDownloadRequest(sender, settings, {
    commandName: ctx.commandName || meta.commandName || "",
    botId: ctx.botId || "",
    botLabel: ctx.botLabel || "",
    chatId: from,
    ...meta,
  });

  if (result.ok) {
    return {
      ok: true,
      charged: true,
      charge: result,
      requests: result.requests,
    };
  }

  await sock.sendMessage(
    from,
    {
      text: buildBlockedMessage(settings, result),
      ...global.channelInfo,
    },
    msg?.key ? { quoted: msg } : undefined
  );

  return {
    ok: false,
    charged: false,
    requests: result,
  };
}

export function refundDownloadCharge(ctx, chargedInfo, meta = {}) {
  if (!chargedInfo?.charged || !chargedInfo?.charge) {
    return null;
  }

  return refundDownloadRequest(ctx.sender, chargedInfo.charge, ctx.settings, {
    commandName: ctx.commandName || "",
    botId: ctx.botId || "",
    botLabel: ctx.botLabel || "",
    chatId: ctx.from,
    ...meta,
  });
}
