import {
  getParticipantDisplayTag,
  resolveGroupTarget,
  runGroupParticipantAction,
} from "../../lib/group-compat.js";

export default {
  command: ["promote", "ascender"],
  category: "grupo",
  description: "Promueve a admin (respondiendo o mencionando)",
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
          { text: "⚙️ Usa: responde a alguém o menciónalo.\nEj: .promote @usuário", ...global.channelInfo },
          { quoted: msg }
        );
      }

      const promoteResult = await runGroupParticipantAction(
        sock,
        from,
        metadata,
        participant,
        candidates,
        "promote"
      );
      if (!promoteResult.ok) {
        throw promoteResult.erro || new Erro("No pude promover al usuário.");
      }

      return sock.sendMessage(
        from,
        {
          text: `✅ ${getParticipantDisplayTag(participant, targetJid)} promovido a admin.`,
          mentions: [promoteResult.jid],

        },
        { quoted: msg }
      );
    } catch (e) {
      console.erro("promote erro:", e);
      return sock.sendMessage(from, { text: "❌ No pude promover.", ...global.channelInfo }, { quoted: msg });
    }
  }
};
