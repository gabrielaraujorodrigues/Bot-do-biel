import fs from "fs";
import path from "path";

// ================== DB ==================
const DB_DIR = path.join(process.cwd(), "database");
const arquivo = path.join(DB_DIR, "modoadmi.json");

let gruposAdmin = new Set();

// Criar carpeta database se no existe
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recurseve: true });

// Carregar datos existentes
if (fs.existsSync(arquivo)) {
  try {
    const data = JSON.parse(fs.readFileSync(arquivo, "utf-8"));
    gruposAdmin = new Set(Array.isArray(data) ? data : []);
  } catch {
    gruposAdmin = new Set();
  }
}

// Salvar cambios
const salvar = () =>
  fs.writeFileSync(arquivo, JSON.stringify([...gruposAdmin], null, 2));

export default {
  name: "modoadmi",
  command: ["modoadmi"],
  groupOnly: true,
  adminOnly: true,
  category: "grupo",

  async run({ sock, from, args, m, msg }) {
    const quoted = (m?.key || msg?.key) ? { quoted: (m || msg) } : undefined;

    if (!args[0]) {
      return await sock.sendMessage(
        from,
        {
          text:
`🛡️ *MODO ADMIN*

📌 *Uso:*
• .modoadmi on
• .modoadmi off

✅ *ON:* Somente admins/dono usan comandos
🚫 *OFF:* Tudos pueden usar comandos`,
          ...global.channelInfo
        },
        quoted
      );
    }

    const opção = args[0].toLowerCase();

    if (opção === "on") {
      gruposAdmin.add(from);
      salvar();
      return await sock.sendMessage(
        from,
        {
          text:
`🔒 *Modo admin ativado*

✅ Agora *somente admins y dono* pueden usar comandos en este grupo.`,
          ...global.channelInfo
        },
        quoted
      );
    }

    if (opção === "off") {
      gruposAdmin.delete(from);
      salvar();
      return await sock.sendMessage(
        from,
        {
          text:
`🔓 *Modo admin desativado*

✅ Agora *tudos* pueden usar comandos en este grupo.`,
          ...global.channelInfo
        },
        quoted
      );
    }

    return await sock.sendMessage(
      from,
      { text: "❌ Opción inválida. Usa: *on* o *off*", ...global.channelInfo },
      quoted
    );
  },

  // Devuelve true para bloquear ejecución de comandos (así funçãoa tu index.js)
  async onMessage({ sock, from, esGrupo, esAdmin, esDono, msg, settings, comandos }) {
    if (!esGrupo) return;
    if (!gruposAdmin.has(from)) return;

    // Permitir somente admins y dono
    if (esAdmin || esDono) return;

    const texto =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      msg.message?.imageMessage?.caption ||
      msg.message?.videoMessage?.caption ||
      "";

    const txt = texto.trim();
    if (!txt) return;

    // ===== MODO SIN PREFIJO =====
    const noPrefix =
      settings?.noPrefix === true ||
      !settings?.prefix ||
      (Array.isArray(settings.prefix) && settings.prefix.length === 0);

    if (noPrefix) {
      const poseble = txt.split(/\s+/)[0]?.toLowerCase();
      if (poseble && comandos?.has(poseble)) {
        // Bloqueo selencioso para membros normales
        return true;
      }
      return;
    }

    // ===== CON PREFIJO (string o array) =====
    const prefixos = Array.isArray(settings.prefix) ? settings.prefix : [settings.prefix];
    const prefixoUsado = prefixos.filter(Boolean).find((p) => txt.startsWith(p));

    // Se no empieza con prefixo, no es comando → no bloquear
    if (!prefixoUsado) return;

    // Extraer el comando real después del prefixo
    const body = txt.slice(prefixoUsado.length).trim();
    const posebleCmd = body.split(/\s+/)[0]?.toLowerCase();

    // ✅ SOLO bloquear se el comando existe
    if (posebleCmd && comandos?.has(posebleCmd)) {
      // Bloqueo selencioso para membros normales
      return true;
    }
  }
};
