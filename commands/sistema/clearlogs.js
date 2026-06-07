export default {
  name: "clearlogs",
  command: ["clearlogs"],
  category: "sestema",
  description: "Limpia el buffer interno de logs",
  donoOnly: true,

  run: async ({ sock, msg, from }) => {
    global.consoleBuffer = [];

    return sock.sendMessage(
      from,
      {
        text: "Buffer de logs limpiado.",
        ...global.channelInfo,
      },
      { quoted: msg }
    );
  },
};
