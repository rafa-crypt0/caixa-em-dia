import { existsSync, mkdirSync, createWriteStream, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { get as httpsGet } from 'node:https';
import net from 'node:net';

const EMULATOR_HOST = '127.0.0.1';
const EMULATOR_PORT = 8080;
const JAR_NAME = 'cloud-firestore-emulator-v1.19.8.jar';
const JAR_URL = `https://storage.googleapis.com/firebase-preview-drop/emulator/${JAR_NAME}`;
const CACHE_DIR = join(homedir(), '.cache', 'firebase', 'emulators');
const JAR_PATH = join(CACHE_DIR, JAR_NAME);

function findJava() {
  if (process.env.JAVA_HOME) {
    const candidate = join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
    if (existsSync(candidate)) return candidate;
  }
  const check = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', ['java'], { encoding: 'utf8' });
  if (check.status === 0 && check.stdout.trim()) {
    return check.stdout.trim().split(/\r?\n/)[0];
  }
  if (process.platform === 'win32') {
    const roots = [
      'C:\\Program Files\\JetBrains',
      'C:\\Program Files\\Eclipse Adoptium',
      'C:\\Program Files\\Java',
      'C:\\Program Files\\Microsoft'
    ];
    for (const root of roots) {
      if (!existsSync(root)) continue;
      for (const dir of readdirSync(root)) {
        for (const sub of ['jbr\\bin\\java.exe', 'bin\\java.exe']) {
          const p = join(root, dir, sub);
          if (existsSync(p)) return p;
        }
      }
    }
  }
  throw new Error('Java runtime (java) não encontrado. Instale o JDK/JRE ou defina JAVA_HOME.');
}

function isPortOpen(host, port) {
  return new Promise(res => {
    const sock = new net.Socket();
    sock.setTimeout(600);
    sock.once('connect', () => { sock.destroy(); res(true); });
    sock.once('error', () => { sock.destroy(); res(false); });
    sock.once('timeout', () => { sock.destroy(); res(false); });
    sock.connect(port, host);
  });
}

function downloadJar(url, dest) {
  mkdirSync(CACHE_DIR, { recursive: true });
  return new Promise((res, rej) => {
    console.log(`Baixando Firebase Firestore Emulator (${JAR_NAME})...`);
    httpsGet(url, response => {
      if (response.statusCode !== 200) {
        rej(new Error(`Falha ao baixar emulador: HTTP ${response.statusCode}`));
        return;
      }
      const file = createWriteStream(dest);
      response.pipe(file);
      file.on('finish', () => file.close(res));
      file.on('error', rej);
    }).on('error', rej);
  });
}

async function waitForPort(host, port, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isPortOpen(host, port)) return;
    await new Promise(r => setTimeout(r, 300));
  }
  throw new Error(`Timeout aguardando Firestore Emulator em ${host}:${port}`);
}

async function main() {
  const alreadyRunning = await isPortOpen(EMULATOR_HOST, EMULATOR_PORT);
  let emuProc = null;

  if (!alreadyRunning) {
    if (!existsSync(JAR_PATH)) {
      await downloadJar(JAR_URL, JAR_PATH);
    }
    const javaBin = findJava();
    console.log(`Iniciando Firestore Emulator em ${EMULATOR_HOST}:${EMULATOR_PORT}...`);
    emuProc = spawn(javaBin, [
      '-Duser.language=en',
      '-jar', JAR_PATH,
      '--host', EMULATOR_HOST,
      '--port', String(EMULATOR_PORT)
    ], { stdio: 'ignore' });

    emuProc.on('error', err => {
      console.error('Erro ao iniciar Firestore Emulator:', err);
    });

    await waitForPort(EMULATOR_HOST, EMULATOR_PORT, 30000);
  } else {
    console.log(`Usando Firestore Emulator já ativo em ${EMULATOR_HOST}:${EMULATOR_PORT}...`);
  }

  try {
    const projectRoot = resolve(import.meta.dirname, '..');
    const vitestBin = join(projectRoot, 'node_modules', 'vitest', 'vitest.mjs');
    const child = spawn(process.execPath, [vitestBin, 'run', 'tests/firestore.rules.test.js'], {
      cwd: projectRoot,
      stdio: 'inherit',
      env: {
        ...process.env,
        FIRESTORE_EMULATOR_HOST: `${EMULATOR_HOST}:${EMULATOR_PORT}`
      }
    });
    const exitCode = await new Promise(res => child.on('close', res));
    process.exitCode = exitCode ?? 1;
  } finally {
    if (emuProc) {
      emuProc.kill();
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
