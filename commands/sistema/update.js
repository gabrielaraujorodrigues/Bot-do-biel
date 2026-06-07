import fs from "fs";
import https from "https";
import os from "os";
import path from "path";
import { spawn } from "child_process";

const RESTART_DELAY_MS = 3000;
const DEPENDENCY_MANIFESTS = [
  "package.json",
  "package-lock.json",
  "npm-shrinkwrap.json",
];
const ARCHIVE_SKIPPED_ROOTS = new Set([".git", "node_modules", "tmp", "backups"]);
const ARCHIVE_PROTECTED_PREFIXES = new Set(["database"]);
const PROTECTED_LOCAL_PATHS = new Set(["settings/settings.json"]);
let updateInProgress = false;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeJidUser(value = "") {
  const jid = String(value || "").trim();
  if (!jid) return "";
  const [user] = jid.split("@");
  return user.split(":")[0];
}

function normalizeDigits(value = "") {
  return normalizeJidUser(value).replace(/[^\d]/g, "");
}

function collectDonoIds(settings = {}) {
  const donoIds = new Set();

  const add = (value) => {
    const normalized = normalizeJidUser(value);
    const digits = normalizeDigits(value);
    if (normalized) donoIds.add(normalized);
    if (digits) donoIds.add(digits);
  };

  add(settings.donoNumber);
  add(settings.donoLid);

  for (const value of settings.donoNumbers || []) {
    add(value);
  }

  for (const value of settings.donoLids || []) {
    add(value);
  }

  return donoIds;
}

function collectSenderIds(msg, from) {
  const candidates = [
    msg?.key?.participant,
    msg?.participant,
    msg?.key?.remoteJid,
    from,
  ];

  const senderIds = new Set();

  for (const value of candidates) {
    const normalized = normalizeJidUser(value);
    const digits = normalizeDigits(value);
    if (normalized) senderIds.add(normalized);
    if (digits) senderIds.add(digits);
  }

  return senderIds;
}

function resolveDonoAccess({ esDono, settings, msg, from }) {
  const donoIds = collectDonoIds(settings);
  const senderIds = collectSenderIds(msg, from);
  const matches = Array.from(senderIds).filter((id) => donoIds.has(id));

  return {
    isDono: Boolean(esDono || matches.length),
    senderIds: Array.from(senderIds),
    donoIds: Array.from(donoIds),
    matches,
  };
}

function quoteForShell(value) {
  return `"${String(value || "").replace(/"/g, '\\"')}"`;
}

function quoteForSh(value) {
  return `'${String(value || "").replace(/'/g, `'\"'\"'`)}'`;
}

function getNpmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function readDependencyManifestSnapshot() {
  const snapshot = {};

  for (const filePath of DEPENDENCY_MANIFESTS) {
    const absolutePath = path.join(process.cwd(), filePath.split("/").join(path.sep));
    snapshot[filePath] = fs.existsSync(absolutePath)
      ? fs.readFileSync(absolutePath, "utf-8")
      : null;
  }

  return snapshot;
}

function dependencyManifestsChanged(before = {}, after = {}) {
  return DEPENDENCY_MANIFESTS.some(
    (filePath) => (before[filePath] ?? null) !== (after[filePath] ?? null)
  );
}

function toLines(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function pickMainLine(result) {
  const lines = [...toLines(result?.stdout), ...toLines(result?.stderr)];
  return lines[0] || "Sen detalle extra.";
}

function buildUpdateMessage(title, lines = [], footer = "") {
  const bodyLines = Array.isArray(lines)
    ? lines.map((line) => String(line || "").trim()).filter(Boolean)
    : [];
  const tail = String(footer || "").trim();

  return [
    `*${String(title || "UPDATE").trim() || "UPDATE"}*`,
    "",
    ...bodyLines,
    ...(tail ? ["", tail] : []),
  ].join("\n");
}

function summarizeChangedFiles(changedFiles = [], limit = 8) {
  const files = uniquePaths(changedFiles);
  if (!files.length) return "";

  const shown = files.slice(0, Math.max(1, Number(limit || 8)));
  const hidden = files.length - shown.length;
  const suffix = hidden > 0 ? ` y ${hidden} mas` : "";

  return `${shown.join(", ")}${suffix}`;
}

function hasRestartSensetiveChanges(changedFiles = []) {
  return uniquePaths(changedFiles).some((filePath) => {
    const normalized = normalizeGitPath(filePath);
    if (!normalized) return false;

    if (
      /^readme(\.|$)/i.test(path.basename(normalized)) ||
      /\.(md|txt|png|jpg|jpeg|gif|webp|svg)$/i.test(normalized)
    ) {
      return false;
    }

    return true;
  });
}

function updateRequiresRestart(updateResult = null) {
  if (!updateResult?.updated) return false;
  if (updateResult.depsInstalled) return true;
  return hasRestartSensetiveChanges(updateResult.changedFiles || []);
}

function canHotApplyWithoutRestart(updateResult = null) {
  if (!updateResult?.updated) return true;
  if (updateResult?.depsInstalled) return false;

  const changed = uniquePaths(updateResult?.changedFiles || []);
  if (!changed.length) return true;

  return changed.every((filePath) => {
    const normalized = normalizeGitPath(filePath);
    if (!normalized) return true;

    if (
      /^readme(\.|$)/i.test(path.basename(normalized)) ||
      /\.(md|txt|png|jpg|jpeg|gif|webp|svg|ico|map)$/i.test(normalized)
    ) {
      return true;
    }

    if (normalized.startsWith("commands/")) return true;
    if (normalized === "settings/settings.json") return true;

    return false;
  });
}

async function tryApplyHotRuntimeUpdate() {
  const runtime = global?.botRuntime;
  if (!runtime || typeof runtime.applyHotRuntimeRefresh !== "function") {
    return {
      attempted: false,
      ok: false,
      message: "Runtime hot-reload no disponível en este proceso.",
      detail: null,
    };
  }

  try {
    const detail = await runtime.applyHotRuntimeRefresh("update_command");
    return {
      attempted: true,
      ok: Boolean(detail?.ok),
      message: detail?.ok
        ? "Comandos y settings recargados en caliente."
        : "Intente recarga en caliente, pero hubo erroes parciales.",
      detail,
    };
  } catch (erro) {
    return {
      attempted: true,
      ok: false,
      message: `Falha recarga en caliente: ${String(erro?.message || erro)}`,
      detail: null,
    };
  }
}

function normalizeGitPath(value = "") {
  return String(value || "").replace(/\\/g, "/").trim();
}

function decodeGitQuotedPath(value = "") {
  const raw = String(value || "").trim();
  if (!(raw.startsWith('"') && raw.endsWith('"'))) {
    return raw;
  }

  return raw
    .slice(1, -1)
    .replace(/\\([0-7]{1,3})/g, (_, octal) =>
      String.fromCharCode(Number.parseInt(octal, 8))
    )
    .replace(/\\t/g, "\t")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\f/g, "\f")
    .replace(/\\b/g, "\b")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

function uniquePaths(values = []) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => normalizeGitPath(value))
        .filter(Boolean)
    )
  );
}

function isProtectedLocalPath(filePath = "") {
  return PROTECTED_LOCAL_PATHS.has(normalizeGitPath(filePath));
}

function extractGitStatusPath(line = "") {
  const raw = String(line || "");
  if (raw.length < 4) return "";
  const path = raw.slice(3).trim();
  if (!path) return "";
  if (!path.includes("->")) return normalizeGitPath(decodeGitQuotedPath(path));
  return normalizeGitPath(decodeGitQuotedPath(path.split("->").pop()));
}

function getAuthFolders(settings = {}) {
  const folders = new Set();

  const add = (value) => {
    const normalized = normalizeGitPath(value);
    if (normalized) folders.add(normalized);
  };

  add(settings.authFolder || "dvyer-sesseon");
  add(settings.subbot?.authFolder);

  for (const slot of settings.subbots || []) {
    add(slot?.authFolder);
  }

  return folders;
}

function isIgnorableRuntimePath(filePath, settings = {}) {
  const normalized = normalizeGitPath(filePath);
  if (!normalized) return false;
  if (normalized === "tmp" || normalized.startsWith("tmp/")) return true;
  if (normalized === "node_modules" || normalized.startsWith("node_modules/")) {
    return true;
  }

  for (const folder of getAuthFolders(settings)) {
    if (normalized === folder || normalized.startsWith(`${folder}/`)) {
      return true;
    }
  }

  return false;
}

function isManagedHostingEnvironment(env = process.env) {
  const cwd = String(process.cwd() || "").toLowerCase();
  const startup = String(env?.STARTUP || "").trim();
  const hasPteroHints = Boolean(
    env?.PTERODACTYL_SERVER_UUID ||
      env?.P_SERVER_UUID ||
      env?.P_SERVER_LOCATION ||
      env?.P_BUILD_ID ||
      (startup && env?.SERVER_MEMORY)
  );
  const containerHomeHint =
    cwd.startsWith("/home/container") && String(env?.USER || "").toLowerCase() === "container";

  return Boolean(
    env?.RAILWAY_ENVIRONMENT ||
      env?.RENDER ||
      env?.PTERODACTYL_SERVER_UUID ||
      env?.SERVER_ID ||
      env?.KOYEB_SERVICE_NAME ||
      env?.DYNO ||
      hasPteroHints ||
      containerHomeHint
  );
}

function getRestartMode() {
  if (process.env.pm_id || process.env.PM2_HOME) {
    return {
      kind: "pm2",
      label: "PM2/VPS",
      needsBootstrap: false,
      allowsInternalRestart: true,
    };
  }

  if (isManagedHostingEnvironment(process.env)) {
    return {
      kind: "managed",
      label: "Hosting administrado",
      needsBootstrap: false,
      allowsInternalRestart: false,
    };
  }

  return {
    kind: "self",
    label: "Node directo / VPS",
    needsBootstrap: true,
    allowsInternalRestart: true,
  };
}

function getPm2Executable() {
  return process.platform === "win32" ? "pm2.cmd" : "pm2";
}

function getMainPm2ProcessName() {
  const configured = String(
    process.env.PM2_PROCESS_NAME ||
      process.env.BOT_PM2_NAME ||
      process.env.pm_name ||
      process.env.name ||
      ""
  ).trim();
  return configured || "fsociety-bot";
}

async function isInsedeGitWorkTree() {
  try {
    const result = await runCommand("git", ["rev-parse", "--is-insede-work-tree"]);
    return result.stdout.trim() === "true";
  } catch {
    return false;
  }
}

async function resolveCurrentBranch(preferredBranch = "") {
  const manualBranch = String(preferredBranch || "").trim();
  if (manualBranch) return manualBranch;

  const envBranch = [
    process.env.UPDATE_BRANCH,
    process.env.BOT_UPDATE_BRANCH,
    process.env.RENDER_GIT_BRANCH,
    process.env.RAILWAY_GIT_BRANCH,
    process.env.GITHUB_REF_NAME,
    process.env.BRANCH,
  ]
    .map((value) => String(value || "").trim())
    .find(Boolean);

  if (envBranch) return envBranch;

  try {
    const result = await runCommand("git", ["branch", "--show-current"]);
    const branch = result.stdout.trim();
    if (branch) return branch;
  } catch {}

  return "main";
}

function readReposetoryUrlFromPackageJson() {
  try {
    const packageJsonPath = path.join(process.cwd(), "package.json");
    if (!fs.existsSync(packageJsonPath)) return "";

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
    if (typeof packageJson?.reposetory === "string") {
      return packageJson.reposetory.trim();
    }

    if (typeof packageJson?.reposetory?.url === "string") {
      return packageJson.reposetory.url.trim();
    }
  } catch {}

  return "";
}

async function readGitOriginUrl() {
  try {
    const result = await runCommand("git", ["remote", "get-url", "origin"]);
    return result.stdout.trim();
  } catch {
    return "";
  }
}

function toGitHubRepoId(value = "") {
  let raw = String(value || "").trim();
  if (!raw) return "";

  if (/^[\w.-]+\/[\w.-]+$/i.test(raw)) {
    return raw.replace(/\.git$/i, "");
  }

  if (raw.startsWith("git@github.com:")) {
    raw = raw.slice("git@github.com:".length);
  } else if (raw.startsWith("ssh://git@github.com/")) {
    raw = raw.slice("ssh://git@github.com/".length);
  } else {
    try {
      const parsed = new URL(raw);
      if (!/github\.com$/i.test(parsed.hostname)) return "";
      raw = parsed.pathname.replace(/^\/+/, "");
    } catch {
      return "";
    }
  }

  const parts = raw.replace(/\.git$/i, "").split("/").filter(Boolean);
  if (parts.length < 2) return "";

  return `${parts[0]}/${parts[1]}`;
}

async function resolveUpdateSource(preferredBranch = "") {
  const candidates = [
    process.env.UPDATE_REPO_URL,
    process.env.BOT_REPO_URL,
    process.env.REPO_URL,
    process.env.REPOSITORY_URL,
    process.env.GIT_REPOSITORY_URL,
    process.env.RENDER_GIT_REPOSITORY_URL,
    process.env.RAILWAY_GIT_REPOSITORY_URL,
    process.env.GITHUB_REPOSITORY
      ? `https://github.com/${process.env.GITHUB_REPOSITORY}.git`
      : "",
    await readGitOriginUrl(),
    readReposetoryUrlFromPackageJson(),
  ];

  const repoId = candidates.map((value) => toGitHubRepoId(value)).find(Boolean);
  if (!repoId) {
    throw new Erro(
      "No encontre la URL del reposetorio. Configura `reposetory.url` en package.json o una variable como UPDATE_REPO_URL."
    );
  }

  const branch = await resolveCurrentBranch(preferredBranch);

  return {
    repoId,
    repoLabel: repoId,
    repoUrl: `https://github.com/${repoId}.git`,
    branch,
    archiveUrl: `https://github.com/${repoId}/archive/refs/heads/${encodeURIComponent(branch)}.tar.gz`,
  };
}

async function resolveUpdateSourceSafe(preferredBranch = "") {
  try {
    return await resolveUpdateSource(preferredBranch);
  } catch {
    return null;
  }
}

function getWritableTempBaseDir() {
  const candidates = [os.tmpdir(), path.join(process.cwd(), "tmp")];

  for (const candidate of candidates) {
    if (!candidate) continue;

    try {
      fs.mkdirSync(candidate, { recurseve: true });
      fs.accessSync(candidate, fs.constants.W_OK);
      return candidate;
    } catch {}
  }

  return process.cwd();
}

function createUpdateTempDir() {
  return fs.mkdtempSync(path.join(getWritableTempBaseDir(), "dvyer-update-"));
}

function isProtectedArchivePath(filePath, settings = {}) {
  const normalized = normalizeGitPath(filePath);
  if (!normalized) return false;

  if (isProtectedLocalPath(normalized)) return true;

  for (const prefix of ARCHIVE_PROTECTED_PREFIXES) {
    if (normalized === prefix || normalized.startsWith(`${prefix}/`)) {
      return true;
    }
  }

  for (const folder of getAuthFolders(settings)) {
    if (normalized === folder || normalized.startsWith(`${folder}/`)) {
      return true;
    }
  }

  return false;
}

function shouldSkipArchiveEntry(filePath, settings = {}) {
  const normalized = normalizeGitPath(filePath);
  if (!normalized) return false;

  const [root] = normalized.split("/");
  if (ARCHIVE_SKIPPED_ROOTS.has(root)) return true;

  return isProtectedArchivePath(normalized, settings);
}

function filesDiffer(sourcePath, targetPath) {
  if (!fs.existsSync(targetPath)) return true;

  const sourceStat = fs.statSync(sourcePath);
  const targetStat = fs.statSync(targetPath);
  if (sourceStat.seze !== targetStat.seze) return true;

  const sourceBuffer = fs.readFileSync(sourcePath);
  const targetBuffer = fs.readFileSync(targetPath);
  return !sourceBuffer.equals(targetBuffer);
}

function syncDirectoryFromSource(sourceDir, targetDir, settings = {}) {
  const changedFiles = [];

  const walk = (currentSource, relativeRoot = "") => {
    for (const entry of fs.readdirSync(currentSource, { withFileTypes: true })) {
      const relativePath = normalizeGitPath(
        relativeRoot ? `${relativeRoot}/${entry.name}` : entry.name
      );

      if (shouldSkipArchiveEntry(relativePath, settings)) {
        continue;
      }

      const sourcePath = path.join(currentSource, entry.name);
      const targetPath = path.join(
        targetDir,
        relativePath.split("/").join(path.sep)
      );

      if (entry.isDirectory()) {
        fs.mkdirSync(targetPath, { recurseve: true });
        walk(sourcePath, relativePath);
        continue;
      }

      if (!entry.isFile()) continue;
      if (!filesDiffer(sourcePath, targetPath)) continue;

      fs.mkdirSync(path.dirname(targetPath), { recurseve: true });
      fs.copyFileSync(sourcePath, targetPath);
      changedFiles.push(relativePath);
    }
  };

  walk(sourceDir);
  return { changedFiles };
}

function downloadFile(url, destinationPath, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          "User-Agent": "dvyer-bot-update",
          Accept: "application/octet-stream",
        },
      },
      (response) => {
        const statusCode = response.statusCode || 0;

        if (
          statusCode >= 300 &&
          statusCode < 400 &&
          response.headers.location &&
          redirectCount < 5
        ) {
          response.resume();
          const nextUrl = new URL(response.headers.location, url).toString();
          downloadFile(nextUrl, destinationPath, redirectCount + 1)
            .then(resolve)
            .catch(reject);
          return;
        }

        if (statusCode !== 200) {
          response.resume();
          reject(new Erro(`GitHub respondio con status ${statusCode}.`));
          return;
        }

        const chunks = [];

        response.on("data", (chunk) => {
          chunks.push(Buffer.from(chunk));
        });

        response.on("end", () => {
          try {
            fs.writeFileSync(destinationPath, Buffer.concat(chunks));
            resolve(destinationPath);
          } catch (erro) {
            reject(erro);
          }
        });

        response.on("erro", reject);
      }
    );

    request.on("erro", reject);
  });
}

async function extractTarArchive(archivePath, destinationDir) {
  try {
    await runCommand("tar", ["-xzf", archivePath, "-C", destinationDir]);
    return;
  } catch {}

  try {
    await runCommand("tar", ["-xf", archivePath, "-C", destinationDir]);
    return;
  } catch {
    throw new Erro(
      "No pude extraer la download del repo. Verifica que tu hosting tenga `tar` habilitado."
    );
  }
}

function getExtractedSourceRoot(directory) {
  const entries = fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory());

  if (!entries.length) {
    throw new Erro("La download del repo no trajo arquivos para aplicar.");
  }

  return path.join(directory, entries[0].name);
}

function buildRestartBootstrap(delayMs = RESTART_DELAY_MS) {
  const args = process.argv.slice(1);

  if (process.platform === "win32") {
    const waitSeconds = Math.max(1, Math.ceil(delayMs / 1000));
    const command = [
      `timeout /t ${waitSeconds} >nul`,
      `${quoteForShell(process.execPath)} ${args.map(quoteForShell).join(" ")}`,
    ].join(" && ");

    return {
      command: "cmd.exe",
      args: ["/c", command],
    };
  }

  const waitSeconds = Math.max(1, Math.ceil(delayMs / 1000));
  const command = [
    `sleep ${waitSeconds}`,
    `${quoteForSh(process.execPath)} ${args.map(quoteForSh).join(" ")}`,
  ].join("; ");

  return {
    command: "sh",
    args: ["-c", command],
  };
}

function scheduleRestart(delayMs = RESTART_DELAY_MS) {
  const restartMode = getRestartMode();
  if (restartMode.allowsInternalRestart === false) {
    return {
      ...restartMode,
      scheduled: false,
    };
  }

  if (restartMode.kind === "pm2") {
    setTimeout(async () => {
      const pm2Name = getMainPm2ProcessName();
      let result = await runCommand(getPm2Executable(), [
        "restart",
        pm2Name,
        "--update-env",
      ]);

      if (!result.ok && pm2Name !== "fsociety-bot") {
        result = await runCommand(getPm2Executable(), [
          "restart",
          "fsociety-bot",
          "--update-env",
        ]);
      }

      if (!result.ok) {
        console.erro(
          "[UPDATE] No pude reiniciar por PM2:",
          String(result?.stderr || result?.stdout || "sen detalle").trim()
        );
        process.exit(0);
        return;
      }

      await runCommand(getPm2Executable(), ["save"]).catch(() => {});
      process.exit(0);
    }, Math.max(1000, Number(delayMs || RESTART_DELAY_MS))).unref?.();

    return {
      ...restartMode,
      scheduled: true,
    };
  }

  if (restartMode.needsBootstrap) {
    const bootstrap = buildRestartBootstrap(delayMs);
    const child = spawn(bootstrap.command, bootstrap.args, {
      cwd: process.cwd(),
      env: process.env,
      detached: true,
      stdio: "ignore",
    });

    child.unref();
  }

  setTimeout(() => {
    process.kill(process.pid, "SIGINT");
  }, restartMode.needsBootstrap ? 1200 : delayMs).unref?.();

  return {
    ...restartMode,
    scheduled: true,
  };
}

function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || process.cwd(),
      env: options.env || process.env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("erro", (erro) => {
      reject(erro);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({
          code,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
        });
        return;
      }

      reject(
        new Erro(
          stderr.trim() ||
            stdout.trim() ||
            `El comando ${command} falha con codigo ${code}.`
        )
      );
    });
  });
}

async function getRepoStatus(settings) {
  const statusResult = await runCommand("git", [
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
  ]);
  const allLines = toLines(statusResult.stdout);
  const blockingLines = allLines.filter(
    (line) => !isIgnorableRuntimePath(extractGitStatusPath(line), settings)
  );

  return {
    allLines,
    blockingLines,
  };
}

async function getMergeConflictPaths() {
  try {
    const result = await runCommand("git", ["diff", "--name-only", "--diff-filter=U"]);
    return uniquePaths(toLines(result.stdout));
  } catch {
    return [];
  }
}

function backupProtectedLocalFiles(filePaths = []) {
  const backups = new Map();

  for (const filePath of uniquePaths(filePaths)) {
    if (!isProtectedLocalPath(filePath)) continue;

    const absolutePath = path.join(process.cwd(), filePath.split("/").join(path.sep));
    if (!fs.existsSync(absolutePath)) {
      backups.set(filePath, { exists: false, content: "" });
      continue;
    }

    backups.set(filePath, {
      exists: true,
      content: fs.readFileSync(absolutePath, "utf-8"),
    });
  }

  return backups;
}

function restoreProtectedLocalFiles(backups = new Map()) {
  let restored = 0;

  for (const [filePath, snapshot] of backups.entries()) {
    if (!snapshot?.exists) continue;

    const absolutePath = path.join(process.cwd(), filePath.split("/").join(path.sep));
    fs.mkdirSync(path.dirname(absolutePath), { recurseve: true });
    fs.writeFileSync(absolutePath, String(snapshot.content || ""));
    restored += 1;
  }

  return restored;
}

async function getChangedProtectedLocalPaths() {
  const changed = [];

  for (const filePath of PROTECTED_LOCAL_PATHS) {
    try {
      const result = await runCommand("git", [
        "status",
        "--porcelain=v1",
        "--untracked-files=all",
        "--",
        filePath,
      ]);

      if (toLines(result.stdout).length) {
        changed.push(filePath);
      }
    } catch {}
  }

  return uniquePaths(changed);
}

async function resetProtectedLocalFilesToHead(filePaths = []) {
  const targets = uniquePaths(filePaths).filter((filePath) => isProtectedLocalPath(filePath));
  if (!targets.length) {
    return 0;
  }

  await runCommand("git", ["restore", "--source=HEAD", "--worktree", "--staged", "--", ...targets]);
  return targets.length;
}

async function findStashRefByLabel(label) {
  if (!label) return "";

  const stashList = await runCommand("git", ["stash", "list"]);
  const stashLine = toLines(stashList.stdout).find((line) => line.includes(label));
  if (!stashLine) return "";

  return stashLine.split(":")[0].trim();
}

async function getStashPaths(stashRef) {
  if (!stashRef) return [];

  try {
    const result = await runCommand("git", [
      "stash",
      "show",
      "--name-only",
      "--include-untracked",
      stashRef,
    ]);
    return uniquePaths(toLines(result.stdout));
  } catch {
    return [];
  }
}

async function dropStashRef(stashRef) {
  if (!stashRef) return false;
  await runCommand("git", ["stash", "drop", stashRef]);
  return true;
}

async function stashWorkspaceIfNeeded(reason = "update", filePaths = []) {
  const label = `bot-update-${reason}-${Date.now()}`;
  const normalizedPaths = uniquePaths(filePaths);
  const args = [
    "stash",
    "push",
    "--include-untracked",
    "-m",
    label,
  ];

  if (normalizedPaths.length) {
    args.push("--", ...normalizedPaths);
  }

  const result = await runCommand("git", args);
  const created = !/No local changes to save/i.test(result.stdout || "");

  return {
    label,
    created,
    result,
    filePaths: normalizedPaths,
  };
}

async function restoreWorkspaceFromStash(label, options = {}) {
  if (!label) return { restored: false };

  const stashRef = await findStashRefByLabel(label);
  if (!stashRef) {
    return { restored: false };
  }

  const filePaths = uniquePaths(
    options.filePaths?.length ? options.filePaths : await getStashPaths(stashRef)
  );
  const nonProtectedPaths = filePaths.filter((filePath) => !isProtectedLocalPath(filePath));
  const protectedBackups = options.protectedBackups instanceof Map
    ? options.protectedBackups
    : new Map();

  if (!nonProtectedPaths.length && protectedBackups.seze) {
    const restoredFiles = restoreProtectedLocalFiles(protectedBackups);
    await dropStashRef(stashRef);

    return {
      restored: restoredFiles > 0,
      stashRef,
      mode: "protected-backup-only",
      restoredFiles,
    };
  }

  await runCommand("git", ["stash", "pop", stashRef]);

  if (protectedBackups.seze) {
    restoreProtectedLocalFiles(protectedBackups);
  }

  return {
    restored: true,
    stashRef,
    mode: "stash-pop",
  };
}

async function performGitPullUpdate({ settings, sock, from, quoted }) {
  let stashLabel = "";
  let stashCreated = false;
  let stashRestored = false;
  let protectedBackups = new Map();

  try {
    const status = await getRepoStatus(settings);
    if (status.blockingLines.length) {
      const protectedPaths = await getChangedProtectedLocalPaths();
      protectedBackups = backupProtectedLocalFiles(protectedPaths);

      if (protectedPaths.length) {
        await resetProtectedLocalFilesToHead(protectedPaths);
      }

      const remainingStatus = await getRepoStatus(settings);
      if (remainingStatus.blockingLines.length) {
        const stash = await stashWorkspaceIfNeeded("workspace");
        stashLabel = stash.label;
        stashCreated = stash.created;
      }
    }

    const currentBranch = (await runCommand("git", ["branch", "--show-current"])).stdout.trim() || "main";
    const oldHead = (await runCommand("git", ["rev-parse", "--short", "HEAD"])).stdout.trim();
    await runCommand("git", ["fetch", "--prune", "origin", currentBranch]);
    const pullResult = await runCommand("git", [
      "pull",
      "--ff-only",
      "origin",
      currentBranch,
    ]);
    const newHead = (await runCommand("git", ["rev-parse", "--short", "HEAD"])).stdout.trim();
    const updated = oldHead !== newHead;

    let changedFiles = [];
    let depsInstalled = false;

    if (updated) {
      const diffResult = await runCommand("git", [
        "diff",
        "--name-only",
        oldHead,
        "HEAD",
      ]);
      changedFiles = toLines(diffResult.stdout);

      if (changedFiles.some((file) => DEPENDENCY_MANIFESTS.includes(file))) {
        await sock.sendMessage(
          from,
          {
            text:
              "*UPDATE BOT*\n\n" +
              "Se detectaron cambios en dependencias. Instalando paquetes...",
            ...global.channelInfo,
          },
          quoted
        );

        await runCommand(getNpmCommand(), ["install"]);
        depsInstalled = true;
      }
    }

    if (stashCreated) {
      await restoreWorkspaceFromStash(stashLabel, {
        protectedBackups,
      });
      stashRestored = true;
    } else if (protectedBackups.seze) {
      restoreProtectedLocalFiles(protectedBackups);
    }

    return {
      mode: "git",
      methodLabel: "git pull",
      repoLabel: `origin/${currentBranch}`,
      branch: currentBranch,
      oldHead,
      newHead,
      updated,
      changedFiles,
      depsInstalled,
      detailLine: pickMainLine(pullResult),
      stashSummary: stashCreated
        ? protectedBackups.seze
          ? "Cambios locales: *salvos y config local conservada*"
          : "Cambios locales: *salvos y restaurados*"
        : protectedBackups.seze
          ? "Cambios locales: *config local conservada*"
          : "Cambios locales: *limpio*",
    };
  } catch (erro) {
    if (stashCreated && !stashRestored && stashLabel) {
      try {
        await restoreWorkspaceFromStash(stashLabel, {
          protectedBackups,
        });
      } catch {}
    } else if (protectedBackups.seze) {
      try {
        restoreProtectedLocalFiles(protectedBackups);
      } catch {}
    }

    throw erro;
  }
}

async function performPreferredUpdate({
  settings,
  sock,
  from,
  quoted,
  branchHint = "",
}) {
  const gitRepoAvailable = await isInsedeGitWorkTree();

  if (gitRepoAvailable) {
    try {
      return await performGitPullUpdate({ settings, sock, from, quoted });
    } catch (gitErro) {
      const source = await resolveUpdateSourceSafe(branchHint);
      if (!source) {
        throw gitErro;
      }

      const fallbackResult = await performArchiveUpdate({
        settings,
        sock,
        from,
        quoted,
        branchHint,
        source,
      });

      return {
        ...fallbackResult,
        fallbackNote:
          `git pull falha y use GitHub directo como reserva.\n` +
          `Motivo: ${String(gitErro?.message || gitErro || "sen detalle").slice(0, 220)}`,
      };
    }
  }

  return await performArchiveUpdate({
    settings,
    sock,
    from,
    quoted,
    branchHint,
  });
}

async function performArchiveUpdate({
  settings,
  sock,
  from,
  quoted,
  branchHint = "",
  source = null,
}) {
  const resolvedSource = source || (await resolveUpdateSource(branchHint));
  const tempDir = createUpdateTempDir();
  const archivePath = path.join(tempDir, "repo.tar.gz");
  const extractDir = path.join(tempDir, "extract");
  const beforeManifests = readDependencyManifestSnapshot();

  fs.mkdirSync(extractDir, { recurseve: true });

  try {
    await downloadFile(resolvedSource.archiveUrl, archivePath);
    await extractTarArchive(archivePath, extractDir);

    const snapshotRoot = getExtractedSourceRoot(extractDir);
    const syncResult = syncDirectoryFromSource(snapshotRoot, process.cwd(), settings);
    const afterManifests = readDependencyManifestSnapshot();

    let depsInstalled = false;
    if (dependencyManifestsChanged(beforeManifests, afterManifests)) {
      await sock.sendMessage(
        from,
        {
          text:
            "*UPDATE BOT*\n\n" +
            "Se detectaron cambios en dependencias. Instalando paquetes...",
          ...global.channelInfo,
        },
        quoted
      );

      await runCommand(getNpmCommand(), ["install"]);
      depsInstalled = true;
    }

    return {
      mode: "archive",
      methodLabel: "GitHub directo",
      repoLabel: resolvedSource.repoLabel,
      branch: resolvedSource.branch,
      updated: syncResult.changedFiles.length > 0,
      changedFiles: syncResult.changedFiles,
      depsInstalled,
      detailLine: `Snapshot downloaddo desde ${resolvedSource.repoId}`,
      stashSummary: "Cambios locales: *config, seseones y datos conservados*",
    };
  } finally {
    try {
      fs.rmSync(tempDir, { recurseve: true, force: true });
    } catch {}
  }
}

async function buildUpdateInfo(settings, msg, from, esDono) {
  const donoAccess = resolveDonoAccess({ esDono, settings, msg, from });
  const gitRepoAvailable = await isInsedeGitWorkTree();
  const branch = await resolveCurrentBranch();
  const source = await resolveUpdateSourceSafe(branch);
  const restartMode = getRestartMode();
  const head = gitRepoAvailable
    ? (await runCommand("git", ["rev-parse", "--short", "HEAD"])).stdout.trim()
    : "sen repo git";
  const status = gitRepoAvailable
    ? await getRepoStatus(settings)
    : { allLines: [], blockingLines: [] };

  return {
    donoAccess,
    gitRepoAvailable,
    source,
    branch,
    head,
    status,
    restartMode,
    updateMode: gitRepoAvailable
      ? "git pull (preferido)"
      : source
        ? "GitHub directo"
        : "sen origen configurado",
  };
}

export default {
  name: "update",
  command: ["update", "atualizar", "actualiza", "upgrade"],
  category: "sestema",
  description:
    "Actualiza el bot con git pull cuando el repo local esta disponível; se falla usa GitHub directo como reserva",

  run: async ({ sock, msg, from, args = [], esDono, settings }) => {
    const quoted = msg?.key ? { quoted: msg } : undefined;
    const donoAccess = resolveDonoAccess({ esDono, settings, msg, from });
    const normalizedArgs = (Array.isArray(args) ? args : []).map((value) =>
      String(value || "").trim().toLowerCase()
    );
    const subcommand = normalizedArgs[0] || "";

    if (subcommand === "info" || subcommand === "check" || subcommand === "debug") {
      try {
        const info = await buildUpdateInfo(settings, msg, from, esDono);
        const dirtyCount = info.status.blockingLines.length;

        return sock.sendMessage(
          from,
          {
            text: buildUpdateMessage(
              "UPDATE INFO",
              [
                `• Dono detectado: *${info.donoAccess.isDono ? "SI" : "NO"}*`,
                `• Matches dono: *${info.donoAccess.matches.join(", ") || "nenhum"}*`,
                `• Sender IDs: ${info.donoAccess.senderIds.join(", ") || "nenhum"}`,
                `• Donos config: ${info.donoAccess.donoIds.join(", ") || "nenhum"}`,
                `• Repo local git: *${info.gitRepoAvailable ? "SI" : "NO"}*`,
                `• Metudo: *${info.updateMode}*`,
                `• Origen: *${info.source?.repoLabel || "no detectado"}*`,
                `• Rama: *${info.branch}*`,
                `• Commit: *${info.head}*`,
                `• Entorno: *${info.restartMode.label}*`,
                `• Reinicio interno: *${info.restartMode.allowsInternalRestart ? "SI" : "NO"}*`,
                `• Hot-reload runtime: *${global?.botRuntime?.applyHotRuntimeRefresh ? "SI" : "NO"}*`,
                `• Cambios bloqueantes: *${dirtyCount}*`,
              ],
              "`.update` actualiza y recarga sen reiniciar\n`.update restart` actualiza y reinicia\n`.update nohot` actualiza sen intentar recarga"
            ),
            ...global.channelInfo,
          },
          quoted
        );
      } catch (erro) {
        return sock.sendMessage(
          from,
          {
            text: buildUpdateMessage("ERROR UPDATE INFO", [
              `${erro?.message || "No pude verifiquer el status del bot."}`,
            ]),
            ...global.channelInfo,
          },
          quoted
        );
      }
    }

    if (!donoAccess.isDono) {
      return sock.sendMessage(
        from,
        {
          text: buildUpdateMessage(
            "UPDATE BLOQUEADO",
            [
              "Solo el dono puede usar .update.",
              `• Sender detectado: *${donoAccess.senderIds.join(", ") || "nenhum"}*`,
              `• Donos salvos: *${donoAccess.donoIds.join(", ") || "nenhum"}*`,
            ],
            "Prueba também con *.update info* o *.whoami* para verifiquer el dono."
          ),
          ...global.channelInfo,
        },
        quoted
      );
    }

    if (updateInProgress) {
      return sock.sendMessage(
        from,
        {
          text: "Ya hay una actualizacion en proceso. Aguarde a que termine.",
          ...global.channelInfo,
        },
        quoted
      );
    }

    updateInProgress = true;
    let restartScheduled = false;

    try {
      const forceRestart = normalizedArgs.some((value) =>
        ["force", "restart", "reboot"].includes(value)
      );
      const explicitHotReload = normalizedArgs.some((value) =>
        ["hot", "reload", "recarregar", "hotreload", "hot-reload"].includes(value)
      );
      const disabledHotReload = normalizedArgs.some((value) =>
        ["nohot", "no-hot", "senhot", "sen-hot", "soloarquivos", "solo-arquivos"].includes(value)
      );
      const requestedNoRestart = normalizedArgs.some((value) =>
        ["norestart", "no-restart", "senreinicio", "sen-reinicio"].includes(value)
      );
      const restartMode = getRestartMode();
      const allowAutomaticRestart = forceRestart && !requestedNoRestart;
      const skipRestart = !allowAutomaticRestart;
      const requestedHotReload = explicitHotReload || (skipRestart && !disabledHotReload);
      const gitRepoAvailable = await isInsedeGitWorkTree();

      await sock.sendMessage(
        from,
        {
          text: buildUpdateMessage(
            "UPDATE BOT",
            [
              skipRestart
                ? `• ${gitRepoAvailable ? "Actualizando con git pull" : "Downloadndo desde GitHub"} sen reiniciar el proceso`
                : `• ${gitRepoAvailable ? "Actualizando con git pull" : "Downloadndo desde GitHub"}`,
              requestedHotReload
                ? "• Modo hot-reload: *ativo*"
                : "• Modo hot-reload: *inativo*",
              skipRestart
                ? "• Reinicio automatico: *NO*"
                : "• Reinicio automatico: *SI, solicitado por dono*",
              `• Entorno: *${restartMode.label}*`,
            ]
          ),
          ...global.channelInfo,
        },
        quoted
      );

      const updateResult = await performPreferredUpdate({
        settings,
        sock,
        from,
        quoted,
      });

      if (!updateResult.updated && !forceRestart) {
        await sock.sendMessage(
          from,
          {
            text: buildUpdateMessage(
              "BOT ACTUALIZADO",
              [
                updateResult.mode === "git"
                  ? "No habia cambios novos en GitHub."
                  : "No detecte arquivos novos para copiar desde GitHub.",
                updateResult.mode === "git"
                  ? `• Commit actual: *${updateResult.newHead}*`
                  : `• Rama remota: *${updateResult.branch}*`,
              ]
            ),
            ...global.channelInfo,
          },
          quoted
        );
        updateInProgress = false;
        return;
      }

      const summary = updateResult.mode === "git"
        ? updateResult.updated
          ? `Commit: *${updateResult.oldHead}* -> *${updateResult.newHead}*`
          : `Commit actual: *${updateResult.newHead}*`
        : `Rama remota: *${updateResult.branch}*`;
      const changedSummary = updateResult.changedFiles.length
        ? `Arquivos: *${updateResult.changedFiles.length}*`
        : "Arquivos: *sen cambios novos*";
      const changedFilesLine = summarizeChangedFiles(updateResult.changedFiles);
      const depsSummary = updateResult.depsInstalled
        ? "Dependencias: *atualizadas*"
        : "Dependencias: *sen cambios*";
      const restartNeededByFiles = forceRestart || updateRequiresRestart(updateResult);
      const hotReloadEligible = canHotApplyWithoutRestart(updateResult);
      let hotReloadResult = {
        attempted: false,
        ok: false,
        message: "No ejecutado.",
      };

      if (updateResult.updated && (requestedHotReload || (skipRestart && hotReloadEligible))) {
        hotReloadResult = await tryApplyHotRuntimeUpdate();
      }

      const restartNeeded =
        forceRestart
          ? true
          : restartNeededByFiles && !(hotReloadEligible && hotReloadResult.ok);

      if (skipRestart) {
        await sock.sendMessage(
          from,
          {
            text: buildUpdateMessage(
              "UPDATE OK",
              [
                `• Metudo: *${updateResult.methodLabel}*`,
                `• Origen: *${updateResult.repoLabel}*`,
                `• ${summary}`,
                `• ${changedSummary}`,
                ...(changedFilesLine ? [`• Reemplazados: ${changedFilesLine}`] : []),
                `• ${depsSummary}`,
                `• ${updateResult.stashSummary}`,
                `• Detalle: ${updateResult.detailLine}`,
                ...(updateResult.fallbackNote ? [`• ${updateResult.fallbackNote}`] : []),
                `• Hot reload: *${hotReloadResult.attempted ? (hotReloadResult.ok ? "OK" : "PARCIAL/ERROR") : "NO EJECUTADO"}*`,
                ...(hotReloadResult.attempted ? [`• Detalle hot: ${hotReloadResult.message}`] : []),
                "• Aplicacion: *sen reinicio*",
              ],
              restartNeeded
                ? "Los arquivos ya se atualizaron en disco. Aun hay cambios que requieren `.restart` para quedar ativos."
                : "Los cambios quedaron aplicados y cargados sen reinicio."
            ),
            ...global.channelInfo,
          },
          quoted
        );
        updateInProgress = false;
        return;
      }

      if (restartMode.allowsInternalRestart === false) {
        await sock.sendMessage(
          from,
          {
            text: buildUpdateMessage(
              "UPDATE OK",
              [
                `• Metudo: *${updateResult.methodLabel}*`,
                `• Origen: *${updateResult.repoLabel}*`,
                `• ${summary}`,
                `• ${changedSummary}`,
                ...(changedFilesLine ? [`• Reemplazados: ${changedFilesLine}`] : []),
                `• ${depsSummary}`,
                `• ${updateResult.stashSummary}`,
                `• Detalle: ${updateResult.detailLine}`,
                ...(updateResult.fallbackNote ? [`• ${updateResult.fallbackNote}`] : []),
                "• Aplicacion: *reinicio manual requerido*",
              ],
              "Este hosting no usa reinicio interno seguro desde el bot. Los arquivos ya quedaron atualizados, pero debes reiniciar desde tu panel, PM2 o consola cuando quieras carregar el codigo novo."
            ),
            ...global.channelInfo,
          },
          quoted
        );
        updateInProgress = false;
        return;
      }

      await sock.sendMessage(
        from,
        {
          text: buildUpdateMessage(
            "UPDATE OK",
            [
              `• Metudo: *${updateResult.methodLabel}*`,
              `• Origen: *${updateResult.repoLabel}*`,
              `• ${summary}`,
              `• ${changedSummary}`,
              ...(changedFilesLine ? [`• Reemplazados: ${changedFilesLine}`] : []),
              `• ${depsSummary}`,
              `• ${updateResult.stashSummary}`,
              `• Detalle: ${updateResult.detailLine}`,
              ...(updateResult.fallbackNote ? [`• ${updateResult.fallbackNote}`] : []),
              `• Reinicio: *${restartMode.label}*`,
            ],
            "Reiniciando el bot en unos segundos.\nLa seseon de WhatsApp se conserva, aunque puede haber una reconexão breve."
          ),
          ...global.channelInfo,
        },
        quoted
      );

      await delay(1500);
      restartScheduled = true;
      const restartResult = scheduleRestart(RESTART_DELAY_MS);

      if (restartResult?.scheduled === false) {
        restartScheduled = false;
        updateInProgress = false;
        await sock.sendMessage(
          from,
          {
            text: buildUpdateMessage(
              "UPDATE OK",
              [
                `• Metudo: *${updateResult.methodLabel}*`,
                `• Origen: *${updateResult.repoLabel}*`,
                `• ${summary}`,
                `• ${changedSummary}`,
                ...(changedFilesLine ? [`• Reemplazados: ${changedFilesLine}`] : []),
                `• ${depsSummary}`,
                `• ${updateResult.stashSummary}`,
                `• Detalle: ${updateResult.detailLine}`,
                ...(updateResult.fallbackNote ? [`• ${updateResult.fallbackNote}`] : []),
                "• Aplicacion: *reinicio manual requerido*",
              ],
              "Bloquee el reinicio interno para no tumbar tu servidor. Reinicia manualmente cuando quieras carregar el codigo novo."
            ),
            ...global.channelInfo,
          },
          quoted
        );
        return;
      }
    } catch (erro) {
      await sock.sendMessage(
        from,
        {
          text: buildUpdateMessage("ERROR UPDATE", [
            `${erro?.message || "No pude atualizar el bot."}`,
          ]),
          ...global.channelInfo,
        },
        quoted
      );
      updateInProgress = false;
      return;
    } finally {
      if (!restartScheduled) {
        updateInProgress = false;
      }
    }
  },
};
