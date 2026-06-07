import fs from "fs";
import path from "path";

function normalizeNumber(value = "") {
  return String(value || "").replace(/[^\d]/g, "").trim();
}

function unique(items = []) {
  return Array.from(new Set(items.filter(Boolean)));
}

function resolveDonoNumbers(settings = {}) {
  const donoNumber = normalizeNumber(settings?.donoNumber || "");
  const donoNumbers = Array.isArray(settings?.donoNumbers)
    ? settings.donoNumbers.map((item) => normalizeNumber(item))
    : [];
  return unique([donoNumber, ...donoNumbers]);
}

function pickPrimaryDono(numbers = []) {
  const preferred = numbers.find((num) => String(num).endsWith("960"));
  return preferred || numbers[0] || "";
}

function resolveStaffImagePath() {
  const imageDir = path.join(process.cwd(), "imagemes");
  const candidates = [
    path.join(imageDir, "staff-suporte.jpg"),
    path.join(imageDir, "staff-suporte.jpeg"),
    path.join(imageDir, "staff-suporte.png"),
    path.join(imageDir, "staff-suporte.webp"),
    path.join(imageDir, "menu-sestema.png"),
  ];
  return candidates.find((filePath) => fs.existsSync(filePath)) || "";
}

function getStaffImageBuffer() {
  const imagePath = resolveStaffImagePath();
  if (!imagePath) return null;
  try {
    return fs.readFileSync(imagePath);
  } catch {
    return null;
  }
}

function buildStaffCaption({
  donoName = "DVYER",
  primaryDono = "",
  adminNumbers = [],
}) {
  const supportList = adminNumbers.length
    ? adminNumbers.map((num, index) => `║ ${String(index + 1).padStart(2, "0")}. wa.me/${num}`)
    : ["║ 01. No hay admins extra configurados."];

  return [
    "╔════════════════════════════════════════════╗",
    "║            ☠️ FSOCIETY STAFF BOT           ║",
    "╠════════════════════════════════════════════╣",
    `║ 👑 Dono principal: *${donoName}*`,
    primaryDono
      ? `║ 📞 Contacto dono: wa.me/${primaryDono}`
      : "║ 📞 Contacto dono: no configurado",
    "║ ⚡ Suporte: resposta rapida y directa",
    "║ 🛡️ Asestencia: reporte de fallas y ajuda bot",
    "╠════════════════════════════════════════════╣",
    "║ 👥 STAFF / ADMIN CONTACTS",
    ...supportList,
    "╠════════════════════════════════════════════╣",
    "║ ✅ Se el bot falla, envía captura + comando usado.",
    "║ ✅ Te ajudamos a solucionarlo lo mas rápido poseble.",
    "╚════════════════════════════════════════════╝",
  ].join("\n");
}

export default {
  command: ["administradores", "admins", "staff", "equipo"],
  category: "sestema",
  description: "Muestra dono y administradores del bot.",

  run: async ({ sock, msg, from, settings }) => {
    const donoName = String(settings?.donoName || "DVYER").trim();
    const allDonos = resolveDonoNumbers(settings);
    const donoMain = pickPrimaryDono(allDonos);
    const admins = allDonos.filter((num) => num && num !== donoMain);
    const caption = buildStaffCaption({
      donoName,
      primaryDono: donoMain,
      adminNumbers: admins,
    });
    const imageBuffer = getStaffImageBuffer();

    if (imageBuffer) {
      return sock.sendMessage(
        from,
        { image: imageBuffer, caption, ...global.channelInfo },
        { quoted: msg }
      );
    }

    return sock.sendMessage(from, { text: caption, ...global.channelInfo }, { quoted: msg });
  },
};
