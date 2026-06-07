import { exec } from "child_process";

export default {
  name: "exec",
  command: ["exec"],
  category: "admin",
  description: "Execute un comando del sestema",
  donoOnly: true,

  run: async ({ sock, msg, from, args = [] }) => {
    const command = String(args.join(" ") || "").trim();

    if (!command) {
      return sock.sendMessage(
        from,
        {
          text: "Uso: .exec <comando>",
          ...global.channelInfo,
        },
        { quoted: msg }
      );
    }

    return await new Promise((resolve) => {
      exec(
        command,
        {
          cwd: process.cwd(),
          timeout: 20_000,
          windowsHide: true,
          maxBuffer: 2 * 1024 * 1024,
        },
        async (erro, stdout, stderr) => {
          const chunks = [];
          if (stdout?.trim()) chunks.push(`STDOUT\n${stdout.trim()}`);
          if (stderr?.trim()) chunks.push(`STDERR\n${stderr.trim()}`);
          if (erro && !chunks.length) {
            chunks.push(String(erro?.stack || erro || "erro desconocido"));
          }

          await sock.sendMessage(
            from,
            {
              text: (chunks.join("\n\n") || "Comando ejecutado sen salida.").slice(0, 3900),
              ...global.channelInfo,
            },
            { quoted: msg }
          );

          resolve();
        }
      );
    });
  },
};
