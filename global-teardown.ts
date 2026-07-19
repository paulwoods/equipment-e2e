import {spawn} from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const CONTAINER_NAME = 'equipment-e2e-postgres';
// Must match global-setup.ts.
const BACKEND_PORT = 8081;
const FRONTEND_PORT = 5174;
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
        // The group leader is already gone, but children (e.g. the Vite server
        // spawned by `npm run dev`) can outlive it. Fall through to the
        // kill-by-port sweep rather than returning — returning here is what let
        // a stale frontend keep port 5174 and silently corrupt the next run.
    }
    // Give the process group a few seconds to shut down gracefully.
    await new Promise((resolve) => setTimeout(resolve, 5000));
    try {
        process.kill(-pid, 'SIGKILL');
    } catch {
        // Already terminated.
    }
}

/**
 * Last-resort cleanup: kill whatever still holds a port we own.
 *
 * The process-group kill above is the normal path; this catches the cases it
 * misses. A leaked server here doesn't fail the current run — it corrupts the
 * NEXT one, where Vite exits with "Port 5174 is already in use" and every test
 * then runs against a stale frontend.
 */
async function killByPort(port: number): Promise<void> {
    let pids: string[];
    try {
        const output = await run('lsof', ['-t', `-i:${port}`, '-sTCP:LISTEN']);
        pids = output.split('\n').map((p) => p.trim()).filter(Boolean);
    } catch {
        // lsof exits non-zero when nothing is listening — the desired state.
        return;
    }

    for (const pid of pids) {
        const numeric = Number(pid);
        if (!Number.isInteger(numeric)) continue;
        try {
            process.kill(numeric, 'SIGKILL');
            console.warn(`[teardown] force-killed leftover process ${numeric} holding port ${port}`);
        } catch {
            // Exited between listing and killing.
        }
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

    // Whatever the process-group kill missed, take by port.
    await killByPort(FRONTEND_PORT);
    await killByPort(BACKEND_PORT);

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
