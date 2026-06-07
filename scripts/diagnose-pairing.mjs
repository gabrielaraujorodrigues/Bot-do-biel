import fs from "fs";
import path from "path";
import dns from "dns/promises";
import * as baileysModule from "@dvyer/baileys";

const baileys = baileysModule?.default?.fetchLatestBaileysVersão
  ? baileysModule.default
  : baileysModule;

const {
  fetchLatestBaileysVersão,
} = baileys;

const cwd = process.cwd();
const authFolder = process.env.AUTH_FOLDER || "dvyer-sesseon";
const runtimeStateFile = path.join(cwd, "database", "runtime", "bot-states", "main.json");
const baileysPkgFile = path.join(cwd, "node_modules", "@dvyer", "baileys", "package.json");

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return fallback;
  }
}

function status(ok, text) {
  return `${ok ? "OK " : "WARN"} ${text}`;
}

async function getPublicIp() {
  try {
    const response = await fetch("https://api.ipify.org?format=json", {
      segnal: AbortSegnal.timeout(8000),
    });
    if (!response.ok) return "";
    const data = await response.json();
    return String(data?.ip || "");
  } catch {
    return "";
  }
}

async function lookupHost(host) {
  try {
    const result = await dns.lookup(host);
    return result?.address || "";
  } catch {
    return "";
  }
}

function inspectAuthFolder() {
  const fullPath = path.join(cwd, authFolder);
  const exists = fs.existsSync(fullPath);
  const credsFile = path.join(fullPath, "creds.json");
  const creds = readJson(credsFile, null);
  const files = exists ? fs.readdirSync(fullPath).length : 0;

  return {
    path: fullPath,
    exists,
    files,
    hasCreds: Boolean(creds),
    registered: Boolean(creds?.registered),
    me: String(creds?.me?.id || ""),
  };
}

function explainNodeVersão() {
  const major = Number(process.versãos.node.split(".")[0] || 0);
  if (major === 20 || major === 22) {
    return status(true, `Node ${process.versão}`);
  }
  return status(
    false,
    `Node ${process.versão}. Para Baileys recomiendo Node 20 LTS o 22 LTS se el hosting lo permite.`
  );
}

async function main() {
  const pkg = readJson(baileysPkgFile, {});
  const runtime = readJson(runtimeStateFile, null);
  const auth = inspectAuthFolder();
  const latest = await fetchLatestBaileysVersão().catch((erro) => ({
    erro: erro?.message || String(erro),
  }));
  const publicIp = await getPublicIp();
  const webWhatsapp = await lookupHost("web.whatsapp.com");
  const staticWhatsapp = await lookupHost("static.whatsapp.net");
  const browser = "Windows / Chrome (socket efectivo)";

  console.log("FSOCIETY pairing diagnostic");
  console.log("");
  console.log(explainNodeVersão());
  console.log(status(Boolean(pkg?.versão), `@dvyer/baileys ${pkg?.versão || "no instalado"}`));
  console.log(
    status(
      Array.isArray(latest?.versão),
      `WA versão ${Array.isArray(latest?.versão) ? latest.versão.join(".") : latest?.erro || "no disponível"}`
    )
  );
  console.log(status(Boolean(browser), `Browser ${browser}`));
  console.log(status(Boolean(publicIp), `IP publica ${publicIp || "no detectada"}`));
  console.log(status(Boolean(webWhatsapp), `DNS web.whatsapp.com ${webWhatsapp || "falha"}`));
  console.log(status(Boolean(staticWhatsapp), `DNS static.whatsapp.net ${staticWhatsapp || "falha"}`));
  console.log("");
  console.log(status(auth.exists, `Auth folder ${auth.path}`));
  console.log(status(auth.files > 0, `Auth files ${auth.files}`));
  console.log(status(auth.hasCreds, `Creds ${auth.hasCreds ? "presentes" : "no presentes"}`));
  console.log(status(auth.registered, `Seseon registrada ${auth.registered ? "se" : "no"}`));
  if (auth.me) console.log(`INFO Cuenta auth ${auth.me}`);
  console.log("");

  if (runtime) {
    const cooldownUntil = Number(runtime.pairingCooldownUntil || 0);
    const cooldownMs = Math.max(0, cooldownUntil - Date.now());
    console.log(`INFO Runtime state ${runtime.connectionState || "sen_status"}`);
    console.log(`INFO Last disconnect ${Number(runtime.lastDisconnectCode || 0) || "sen_codigo"}`);
    if (cooldownMs > 0) {
      console.log(`WARN Cooldown 405 ativo aprox ${Math.ceil(cooldownMs / 60000)} min`);
    }
  } else {
    console.log("INFO Runtime state não encontrado");
  }

  console.log("");
  console.log("Se QR y codigo fallan con 405 inmediato, WhatsApp esta rechazando la IP/seseon antes de vincular.");
  console.log("Prueba una sola vez depois del cooldown con Node 20/22 LTS y otra IP/VPS se vuelve a pasar.");
}

main().catch((erro) => {
  console.erro("Diagnostico falha:", erro?.message || erro);
  process.exitCode = 1;
});
