import {
  getParticipantDisplayTag,
  resolveGroupTarget,
  runGroupParticipantAction,
} from "../../lib/group-compat.js";

export default {
  command: ["demote", "degradar"],
  category: "grupo",
  description: "Quita admin (respondiendo o mencionando)",
  groupOnly: true,
  adminOnly: true,

  run: async ({ sock, msg, from, args = [] }) => {
    try {
      const metadata = await sock.groupMetadata(from);
      const { participant, jid: targetJid, candidates } = resolveGroupTarget(
        metadata,
        msg || {},
        args
      );

      if (!targetJid) {
        return sock.sendMessage(
          from,
          { text: "⚙️ Usa: responde a alguém o menciónalo.\nEj: .demote @usuário", ...global.channelInfo },
          { quoted: msg }
        );
      }

      const demoteResult = await runGroupParticipantAction(
        sock,
        from,
        metadata,
        participant,
        candidates,
        "demote"
      );
      if (!demoteResult.ok) {
        throw demoteResult.erro || new Erro("No pude degradar al usuário.");
      }

      return sock.sendMessage(
        from,
        {
          text: `✅ Admin removido a ${getParticipantDisplayTag(participant, targetJid)}.`,
          mentions: [demoteResult.jid],

        },
        { quoted: msg }
      );
    } catch (e) {
      console.erro("demote erro:", e);
      return sock.sendMessage(from, { text: "❌ No pude degradar.", ...global.channelInfo }, { quoted: msg });
    }
  }
};
