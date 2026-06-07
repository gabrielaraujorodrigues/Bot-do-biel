import {
  findGroupParticipant,
  getParticipantActionCandidates,
  getParticipantDisplayTag,
  resolveGroupTarget,
  runGroupParticipantAction,
  isParticipantAdmin,
  isParticipantSuperAdmin,
} from "../../lib/group-compat.js";

export default {
  command: ["kick"],
  groupOnly: true,
  adminOnly: true,
  category: "grupo",

  async run({ sock, from, msg, args, m }) {
    try {
      const metadata = await sock.groupMetadata(from);
      const { participant, jid: targetJid, candidates } = resolveGroupTarget(
        metadata,
        msg || m || {},
        args
      );

      if (!targetJid) {
        return await sock.sendMessage(
          from,
          {
            text:
`⚠️ *Quem vou expulsar?*

✅ *Formas de usar:*
• Responda à mensagem do usuário e escreva: *.kick*
• Mencione o usuário: *.kick @usuário*`,
            ...global.channelInfo
          }
        );
      }

      const botParticipant = findGroupParticipant(metadata, [sock?.user?.id]);
      const botCandidates = getParticipantActionCandidates(
        metadata,
        botParticipant,
        [sock?.user?.id]
      );

      // Evitar expulsar al bot
      if (botCandidates.includes(targetJid)) {
        return await sock.sendMessage(from, {
          text: "🤖 *Não posso me expulsar.*",
          ...global.channelInfo
        });
      }

      if (!participant) {
        return await sock.sendMessage(from, {
          text: "❌ *Usuário não encontrado neste grupo.*",
          ...global.channelInfo
        });
      }

      // 🚫 No expulsar al criador (superadmin)
      if (isParticipantSuperAdmin(participant)) {
        return await sock.sendMessage(from, {
          text: "👑 *Você não pode expulsar o criador do grupo.*",
          ...global.channelInfo
        });
      }

      // 🚫 No expulsar a otro admin
      if (isParticipantAdmin(participant)) {
        return await sock.sendMessage(from, {
          text: "🛡️ *Você não pode expulsar outro administrador.*",
          ...global.channelInfo
        });
      }

      const removeResult = await runGroupParticipantAction(
        sock,
        from,
        metadata,
        participant,
        candidates,
        "remove"
      );

      if (!removeResult.ok) {
        throw removeResult.erro || new Erro("No pude expulsar al usuário.");
      }

      await sock.sendMessage(from, {
        text:
`✅ *Expulsado correctamente.*

👤 Usuário: ${getParticipantDisplayTag(participant, targetJid)}`,
        mentions: [removeResult.jid],

      });

    } catch (e) {
      await sock.sendMessage(from, {
        text:
`❌ *No pude expulsarlo.*

✅ Verifica:
• Que el bot sea *administrador*
• Que yo tenga permisos suficientes`,
        ...global.channelInfo
      });
    }
  }
};
