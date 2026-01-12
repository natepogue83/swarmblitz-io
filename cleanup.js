import { exec } from 'child_process';
import { platform } from 'os';

const isWindows = platform() === 'win32';
const ports = [8083, 3000];

function killPort(port) {
  return new Promise((resolve) => {
    if (isWindows) {
      // Windows: find and kill process using the port
      exec(`netstat -ano | findstr :${port} | findstr LISTENING`, (err, stdout) => {
        if (err || !stdout.trim()) {
          resolve();
          return;
        }
        // Extract PIDs from netstat output
        const lines = stdout.trim().split('\n');
        const pids = new Set();
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && /^\d+$/.test(pid) && pid !== '0') {
            pids.add(pid);
          }
        }
        // Kill each PID
        const killPromises = [...pids].map(pid => 
          new Promise(res => {
            exec(`taskkill /F /PID ${pid}`, () => res());
          })
        );
        Promise.all(killPromises).then(() => resolve());
      });
    } else {
      // Unix: use lsof and kill
      exec(`lsof -ti:${port} | xargs kill -9 2>/dev/null || true`, () => resolve());
    }
  });
}

async function cleanup() {
  console.log('Cleaning up...');
  
  // Kill processes on ports
  await Promise.all(ports.map(killPort));
  
  // Small delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  console.log('Cleanup complete.');
}

cleanup();
