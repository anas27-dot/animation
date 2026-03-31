/**
 * Frees PORT (from .env or default 5000), then starts nodemon.
 * Windows: netstat + taskkill. macOS/Linux: lsof + kill.
 */
require('dotenv').config();
const path = require('path');
const { spawn, execSync } = require('child_process');

const port = parseInt(process.env.PORT || '5000', 10);
const root = path.join(__dirname, '..');

function freePortWindows(p) {
  let out;
  try {
    out = execSync('netstat -ano', { encoding: 'utf8' });
  } catch {
    return;
  }
  const re = new RegExp(
    `(?:\\[[^\\]]+\\]|(?:\\d+\\.){3}\\d+):${p}\\s+\\S+\\s+LISTENING\\s+(\\d+)`,
    'gi'
  );
  const pids = new Set();
  let m;
  while ((m = re.exec(out)) !== null) {
    pids.add(m[1]);
  }
  for (const pid of pids) {
    try {
      execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
      console.log(`[dev] Stopped PID ${pid} (was listening on port ${p})`);
    } catch {
      /* ignore */
    }
  }
}

function freePortUnix(p) {
  try {
    const out = execSync(`lsof -ti tcp:${p}`, { encoding: 'utf8' });
    const pids = out
      .trim()
      .split(/\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const pid of pids) {
      try {
        execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
        console.log(`[dev] Stopped PID ${pid} (was using port ${p})`);
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* nothing listening */
  }
}

async function freePort(p) {
  if (process.platform === 'win32') {
    freePortWindows(p);
  } else {
    freePortUnix(p);
  }
  await new Promise((r) => setTimeout(r, 400));
}

async function main() {
  console.log(`[dev] Ensuring port ${port} is free...`);
  await freePort(port);

  const nodemonCli = path.join(root, 'node_modules', 'nodemon', 'bin', 'nodemon.js');
  const child = spawn(process.execPath, [nodemonCli, 'index.js'], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });

  child.on('exit', (code, signal) => {
    process.exit(code != null ? code : signal ? 1 : 0);
  });
}

main();
