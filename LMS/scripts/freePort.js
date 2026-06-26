/**
 * Free the server port before starting (kills any leftover/zombie instance).
 * Runs automatically via the npm "preserver"/"prestart" hooks.
 */
const { execSync } = require('child_process');

const PORT = process.env.PORT || 2026;

function killOnPort(port) {
  const pids = new Set();
  try {
    const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
    out.split(/\r?\n/).forEach((line) => {
      if (!/LISTENING/i.test(line)) return;
      const m = line.match(/:(\d+)\s+\S+\s+LISTENING\s+(\d+)/i);
      if (m && m[1] === String(port)) pids.add(m[2]);
    });
  } catch {
    // findstr exits non-zero when nothing matches -> port already free
  }

  if (!pids.size) {
    console.log(`Port ${port} is free.`);
    return;
  }
  for (const pid of pids) {
    try {
      execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
      console.log(`Freed port ${port} (stopped stale PID ${pid}).`);
    } catch {
      /* already gone */
    }
  }
}

killOnPort(PORT);
