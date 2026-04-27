import { spawn } from 'child_process';

const pythonCandidates = [];

if (process.env.PYTHON_PATH) {
  pythonCandidates.push({ command: process.env.PYTHON_PATH, prefixArgs: [] });
}

// Windows launcher fallback
pythonCandidates.push({ command: 'py', prefixArgs: ['-3'] });
pythonCandidates.push({ command: 'python3', prefixArgs: [] });
pythonCandidates.push({ command: 'python', prefixArgs: [] });

function spawnProcess(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code !== 0) {
        const error = new Error(`Python process exited with code ${code}: ${stderr.trim()}`);
        error.code = code;
        reject(error);
        return;
      }
      resolve(stdout);
    });
  });
}

export async function runPythonScript(scriptPath, args) {
  let lastError;
  for (const candidate of pythonCandidates) {
    try {
      return await spawnProcess(candidate.command, [...candidate.prefixArgs, scriptPath, ...args]);
    } catch (error) {
      lastError = error;
      // ENOENT: command missing, 9009: command not found on Windows shells.
      if (error.code === 'ENOENT' || error.code === 9009) {
        continue;
      }
      throw error;
    }
  }

  throw lastError || new Error('Unable to run Python script. Install Python or set PYTHON_PATH.');
}
