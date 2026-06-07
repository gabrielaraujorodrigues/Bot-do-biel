export default {
    name: "prueba", // nome principal
    command: ["test", "p"], // alias opçãoales

    groupOnly: true,
    adminOnly: true,
    category: "grupo",

    async run({ sock, from, esAdmin, esGrupo }) {

        // Verificación manual para debug
        if (!esGrupo) {
            return await sock.sendMessage(from, {
                text: "❌ Este comando solo funçãoa en grupos"
            });
        }

        if (!esAdmin) {
            return await sock.sendMessage(from, {
                text: "⚠️ Solo los administradores pueden usar este comando"
            });
        }

        await sock.sendMessage(from, {
            text: "✅ Sestema de permisos funçãoando correctamente 😎🔥"
        });
    }
};
