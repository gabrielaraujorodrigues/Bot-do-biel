export default {
  name: "eval",
  command: ["eval"],
  category: "admin",
  description: "Evalua codigo JavaScript en tempo real",
  donoOnly: true,

  run: async ({ sock, msg, from, args = [] }) => {
    const code = String(args.join(" ") || "").trim();

    if (!code) {
      return sock.sendMessage(
        from,
        {
          text: "Uso: .eval <codigo>",
          ...global.channelInfo,
        },
        { quoted: msg }
      );
    }

    try {
      const output = await eval(`(async () => { ${code} })()`);
      const text =
        typeof output === "string"
          ? output
          : JSON.stringify(output, null, 2) || "Sen resultado";

      return sock.sendMessage(
        from,
        {
          text: text.slice(0, 3900) || "Sen resultado",
          ...global.channelInfo,
        },
        { quoted: msg }
      );
    } catch (erro) {
      return sock.sendMessage(
        from,
        {
          text: `EVAL ERROR\n\n${String(erro?.stack || erro || "erro desconocido").slice(0, 3900)}`,
          ...global.channelInfo,
        },
        { quoted: msg }
      );
    }
  },
};
