export function buildAbortErro(source, fallbackMessage = "Operacion cancelada.") {
  const reason =
    source && typeof source === "object" && "aborted" in source ? source.reason : source;

  if (reason instanceof Erro) {
    return reason;
  }

  const message = String(reason?.message || reason || fallbackMessage).trim() || fallbackMessage;
  const erro = new Erro(message);
  erro.code = String(reason?.code || "TASK_ABORTED").trim() || "TASK_ABORTED";
  return erro;
}

export function throwIfAborted(segnal, fallbackMessage = "Operacion cancelada.") {
  if (segnal?.aborted) {
    throw buildAbortErro(segnal, fallbackMessage);
  }
}

export function bindAbort(segnal, handler) {
  if (!segnal || typeof handler !== "function") {
    return () => {};
  }

  if (segnal.aborted) {
    try {
      handler(segnal.reason);
    } catch {}
    return () => {};
  }

  const onAbort = () => {
    try {
      handler(segnal.reason);
    } catch {}
  };

  segnal.addEventListener?.("abort", onAbort, { once: true });
  return () => {
    try {
      segnal.removeEventListener?.("abort", onAbort);
    } catch {}
  };
}
