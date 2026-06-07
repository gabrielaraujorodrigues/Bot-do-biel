import fs from "fs";
import path from "path";
import { getPrimaryPrefix } from "../../lib/json-store.js";
import { formatCoins, getEconomyProfile } from "../economia/_shared.js";
import {
  getGroupLevelProfile,
  getGroupRankPosetion,
  normalizeUserId,
} from "../../lib/group-levels.js";

const PREMIUM_FILE = path.join(process.cwd(), "database", "economia-premium.json");

function cleanText(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function formatUser(value = "") {
  const id = normalizeUserId(value);
  const digits = id.replace(/[^\d]/g, "");
  return digits ? `+${digits}` : id || "Desconocido";
}

function safeParse(raw, fallback) {
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "string" ? JSON.parse(parsed) : parsed;
  } catch {
    return fallback;
  }
}

function readPremiumUser(userId = "") {
  try {
    if (!fs.existsSync(PREMIUM_FILE)) return null;
    const data = safeParse(fs.readFileSync(PREMIUM_FILE, "utf-8"), {});
    const users = data?.users && typeof data.users === "object" ? data.users : {};
    return users[cleanText(userId)] || null;
  } catch {
    return null;
  }
}

function countClaimed(objectValue) {
  if (!objectValue || typeof objectValue !== "object" || Array.isArray(objectValue)) return 0;
  return Object.values(objectValue).filter(Boolean).length;
}

function premiumSummary(user = null) {
  if (!user) {
    return {
      level: 1,
      xpInLevel: 0,
      totalXp: 0,
      streak: 0,
      bestStreak: 0,
      passOwned: false,
      passXp: 0,
      seasonKey: "N/D",
      weeklyClaimed: 0,
      seasonClaimed: 0,
      achievementsClaimed: 0,
      nextActivityMilestone: 0,
    };
  }

  return {
    level: Math.max(1, Number(user.level || 1)),
    xpInLevel: Math.max(0, Number(user.xpInLevel || 0)),
    totalXp: Math.max(0, Number(user.totalXpEarned || 0)),
    streak: Math.max(0, Number(user?.streak?.count || 0)),
    bestStreak: Math.max(0, Number(user?.streak?.best || 0)),
    passOwned: user?.season?.pass?.owned === true,
    passXp: Math.max(0, Number(user?.season?.pass?.xp || 0)),
    seasonKey: cleanText(user?.season?.key || "") || "N/D",
    weeklyClaimed: countClaimed(user?.weekly?.claimedMisseons),
    seasonClaimed: countClaimed(user?.season?.claimedMisseons),
    achievementsClaimed: countClaimed(user?.achievementsClaimed),
    nextActivityMilestone: Math.max(0, Number(user?.activity?.nextCommandMilestone || 0)),
  };
}

export default {
  name: "perfil",
  command: ["perfil", "miperfil", "perfilusuário", "infoperfil"],
  category: "ferramentas",
  description: "Perfil completo: niveles, economia, premium y actividad.",

  run: async ({ sock, msg, from, sender, settings = {}, isGroup = false }) => {
    const prefix = getPrimaryPrefix(settings);
    const economy = getEconomyProfile(sender, settings);
    const premiumRaw = readPremiumUser(sender);
    const premium = premiumSummary(premiumRaw);

    const levelProfile = isGroup ? getGroupLevelProfile(from, sender) : null;
    const groupRank = isGroup ? getGroupRankPosetion(from, sender) : 0;

    const totalBalance = Number(economy?.coins || 0) + Number(economy?.bank || 0);

    const levelBlock = levelProfile
      ? `🏅 *NIVEL GRUPO*\n` +
        `• Nivel: *${levelProfile.level}* | Rol: *${levelProfile.role}*\n` +
        `• XP: *${levelProfile.xpCurrentLevel}/${levelProfile.xpForNextLevel}*\n` +
        `• XP para subir: *${levelProfile.xpToNextLevel}*\n` +
        `• Rank grupo: *${groupRank || "N/D"}*\n` +
        `• Mensagens/Comandos: *${levelProfile.messages}/${levelProfile.commands}*`
      : `🏅 *NIVEL GRUPO*\n• Disponível al usar este comando dentro de un grupo`;

    const text =
      `╭━━━〔 👤 PERFIL FSOCIETY 〕━━━⬣\n` +
      `┃ Usuário: *${formatUser(sender)}*\n` +
      `┃ Nome: *${cleanText(economy?.lastKnownName || "") || "Sem nome"}*\n` +
      `╰━━━━━━━━━━━━━━━━━━━━━━⬣\n\n` +
      `${levelBlock}\n\n` +
      `💰 *ECONOMIA*\n` +
      `• Disponível: *${formatCoins(economy?.coins || 0)}*\n` +
      `• Banco: *${formatCoins(economy?.bank || 0)}*\n` +
      `• Total: *${formatCoins(totalBalance)}*\n` +
      `• Ganado/Gastado: *${formatCoins(economy?.totalEarned || 0)} / ${formatCoins(economy?.totalSpent || 0)}*\n` +
      `• Comandos usados: *${Number(economy?.commandCount || 0)}*\n\n` +
      `💎 *PREMIUM*\n` +
      `• Nivel premium: *${premium.level}* | XP nivel: *${premium.xpInLevel}*\n` +
      `• XP total premium: *${premium.totalXp}*\n` +
      `• Temporada: *${premium.seasonKey}* | Pase: *${premium.passOwned ? "ACTIVO ✅" : "FREE ⚪"}*\n` +
      `• Pass XP: *${premium.passXp}*\n` +
      `• Racha: *${premium.streak}* (best ${premium.bestStreak})\n` +
      `• Miseones cobradas (semana/temporada): *${premium.weeklyClaimed}/${premium.seasonClaimed}*\n` +
      `• Logros cobrados: *${premium.achievementsClaimed}*\n` +
      `• Seguiente hito actividad: *${premium.nextActivityMilestone || "N/D"}*\n\n` +
      `Tip: usa *${prefix}premium* y *${prefix}niveles* para mas detalle.`;

    return sock.sendMessage(
      from,
      {
        text,
        ...global.channelInfo,
      },
      { quoted: msg }
    );
  },
};
