import {spawn} from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const CONTAINER_NAME = 'equipment-e2e-postgres';
const STATE_FILE = path.join(os.tmpdir(), 'equipment-e2e-state.json');
const STORAGE_STATE_FILE = path.resolve(__dirname, 'auth.json');

function run(command: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {stdio: ['ignore', 'pipe', 'pipe']});
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (data: Buffer) => {
            stdout += data.toString();
        });
        child.stderr.on('data', (data: Buffer) => {
            stderr += data.toString();
        });
        child.on('close', (code: number | null) => {
            if (code === 0) {
                resolve(stdout.trim());
            } else {
                reject(new Error(stderr || `Process exited with code ${code}`));
            }
        });
    });
}

async function killProcessGroup(pid: number) {
    try {
        process.kill(-pid, 'SIGTERM');
    } catch {
        return;
    }
    // Give the process group a few seconds to shut down gracefully.
    await new Promise((resolve) => setTimeout(resolve, 5000));
    try {
        process.kill(-pid, 'SIGKILL');
    } catch {
        // Already terminated.
    }
}

export default async function globalTeardown() {
    // Shut down the backend and frontend.
    try {
        const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
        if (state.backendPid) {
            await killProcessGroup(state.backendPid);
        }
        if (state.frontendPid) {
            await killProcessGroup(state.frontendPid);
        }
        fs.unlinkSync(STATE_FILE);
    } catch {
        // State file missing or invalid; processes may have already exited.
    }

    // Remove the saved auth storageState so a stale file can't bleed into a future run.
    try {
        fs.unlinkSync(STORAGE_STATE_FILE);
    } catch {
        // Already gone.
    }

    // Remove the Postgres container.
    try {
        await run('docker', ['rm', '-f', CONTAINER_NAME]);
    } catch {
        // If the container is already gone, nothing to do.
    }
}
