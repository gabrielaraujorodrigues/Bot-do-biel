<p align="center">
  <a href="https://www.whatsapp.com/channel/0029VatMd2cGk1FmWw8au11u" target="_blank">
    <img src="https://img.shields.io/badge/Canal%20Oficial%20WhatsApp-25D366?style=for-the-badge&logo=whatsapp&logoColor=white" alt="Canal Oficial" />
  </a>
  <a href="https://chat.whatsapp.com/GuLWXlFUdy3BJA9OXcc1Hj" target="_blank">
    <img src="https://img.shields.io/badge/Comunidade-128C7E?style=for-the-badge&logo=whatsapp&logoColor=white" alt="Comunidade" />
  </a>
  <a href="https://chat.whatsapp.com/FsrlWXVdG3RCLYbZ5LazBO" target="_blank">
    <img src="https://img.shields.io/badge/Suporte-1EBEA5?style=for-the-badge&logo=whatsapp&logoColor=white" alt="Suporte" />
  </a>
</p>

<p align="center">
  <img src="imagenes/menu.png" alt="Bot do Biel - Menu" width="560" />
</p>

<h1 align="center">Bot do Biel</h1>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-24%2B-43853D?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Baileys-MultiBot-25D366?style=for-the-badge&logo=whatsapp&logoColor=white" alt="Baileys" />
  <img src="https://img.shields.io/badge/PM2-Ready-2B037A?style=for-the-badge&logo=pm2&logoColor=white" alt="PM2" />
  <img src="https://img.shields.io/badge/Status-Ativo-success?style=for-the-badge" alt="Status" />
</p>

<p align="center">
Bot de WhatsApp multi-instância com suporte para <b>bot principal + subbots</b>, ideal para VPS, Termux e Windows.
</p>

## Índice

- [Características](#características)
- [Requisitos](#requisitos)
- [Instalação rápida (Linux/VPS)](#instalação-rápida-linuxvps)
- [Instalação no Termux (Android)](#instalação-no-termux-android)
- [Instalação no Linux (Ubuntu/Debian)](#instalação-no-linux-ubuntudebian)
- [Instalação no Windows](#instalação-no-windows)
- [Execução com PM2 (VPS)](#execução-com-pm2-vps-recomendado)
- [Configuração principal](#configuração-principal)
- [Canal direto pelo bot](#canal-direto-pelo-bot)
- [Scripts disponíveis](#scripts-disponíveis)
- [Recomendações](#recomendações)
- [Resolução de problemas](#resolução-de-problemas)

## Características

- Multi-bot por slots (`main` + subbots).
- Vinculação por código para conectar rápido.
- Módulos de comandos: admin, grupos, jogos, downloads, economia, sistema.
- Integração de canal/newsletter para suporte.
- Persistência de sessões para não perder a vinculação.
- Compatível com PM2 para produção.

## Requisitos

- `Node.js` 24 ou superior (obrigatório: Node 24 LTS)
- `npm`
- `git`
- `ffmpeg`

## Instalação rápida (Linux/VPS)

```bash
git clone https://github.com/gabrielaraujorodrigues/Bot-do-biel.git
cd Bot-do-biel
npm install
npm start
```

## Instalação no Termux (Android)

<p>
  <img src="https://cdn.simpleicons.org/android/3DDC84" alt="Android" width="16" />
  <b>Recomendado:</b> Termux do F-Droid.
</p>

```bash
pkg update -y
pkg upgrade -y
pkg install -y git nodejs npm ffmpeg
termux-setup-storage

git clone https://github.com/gabrielaraujorodrigues/Bot-do-biel.git
cd Bot-do-biel
npm install
npm start
```

Se falhar o `npm install` por rede:

```bash
npm install --fetch-retries=5
```

> ⚠️ Certifique-se de que o Node.js instalado é a versão 24 ou superior.

## Instalação no Linux (Ubuntu/Debian)

<p>
  <img src="https://cdn.simpleicons.org/linux/FCC624" alt="Linux" width="16" />
  <b>Servidor ou VPS</b>
</p>

```bash
sudo apt update
sudo apt install -y git ffmpeg curl

# Instalar Node.js 24
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs

git clone https://github.com/gabrielaraujorodrigues/Bot-do-biel.git
cd Bot-do-biel
npm install
npm start
```

## Instalação no Windows

<p>
  <img src="https://cdn.simpleicons.org/windows/0078D6" alt="Windows" width="16" />
  <b>PowerShell</b>
</p>

1. Instale `Node.js 24 LTS`, `Git`, `FFmpeg` (adicionado ao `PATH`).
2. Execute:

```powershell
git clone https://github.com/gabrielaraujorodrigues/Bot-do-biel.git
cd Bot-do-biel
npm install
npm start
```

## Execução com PM2 (VPS recomendado)

<p>
  <img src="https://cdn.simpleicons.org/pm2/2B037A" alt="PM2" width="16" />
  <b>Produção estável</b>
</p>

```bash
npm install -g pm2
npm run pm2:start
pm2 save
pm2 logs
```

## Configuração principal

Arquivo: `settings/settings.json`

- `botName`: nome do bot.
- `ownerNumber` / `ownerNumbers`: donos do bot.
- `prefix`: prefixos de comandos.
- `subbots`: slots e estado dos subbots.
- `newsletter.enabled`: ativa funções de canal.
- `newsletter.jid`: JID do canal.
- `newsletter.name`: nome do canal.
- `newsletter.url`: URL direta do canal (botão de suporte).

Exemplo:

```json
{
  "newsletter": {
    "enabled": true,
    "jid": "120363354701957370@newsletter",
    "name": "Bot-do-biel",
    "url": "https://www.whatsapp.com/channel/0029VatMd2cGk1FmWw8au11u"
  }
}
```

## Canal direto pelo bot

Use este comando no WhatsApp:

```text
.gruposoficiales
```

Se `newsletter.url` estiver configurado, o bot envia botão direto para abrir o canal.

## Scripts disponíveis

```bash
npm start              # Inicia o bot
npm run check          # Verifica sintaxe do index.js
npm run smoke          # Smoke test básico
npm run pm2:start      # Inicia com PM2
npm run pm2:restart    # Reinicia com PM2
```

## Recomendações

- Execute `npm run smoke` após cada mudança grande.
- Não delete as pastas `fsociety-botV1-session/` nem `fsociety-botV1-subbot*/`.
- Faça backup das pastas `settings/` e `database/`.
- Use PM2 em VPS para reinício automático.
- Mantenha o Node.js 24 para evitar incompatibilidades.

## Resolução de problemas

| Problema | Solução |
|---|---|
| Bot não responde | Execute `npm run smoke` |
| Erro de sintaxe | Execute `npm run check` |
| Canal não abre | Verifique `settings.newsletter.url` |
| Sessão perdida | Valide as pastas de sessão |
| Erro de versão do Node | Certifique-se de usar Node.js >= 24 |

## Dono

<p align="center">
  <a href="https://github.com/gabrielaraujorodrigues" target="_blank">
    <img src="https://github.com/gabrielaraujorodrigues.png" width="96" height="96" alt="gabrielaraujorodrigues" />
  </a>
</p>

<p align="center">
  <b>Dono:</b> <a href="https://github.com/gabrielaraujorodrigues">gabrielaraujorodrigues</a>
</p>

## Nota

Este projeto usa Baileys (não é a API oficial do WhatsApp Business). Algumas mudanças do WhatsApp podem afetar funções sem aviso prévio.
