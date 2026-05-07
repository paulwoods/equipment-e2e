import {spawn} from 'child_process';
import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import {request as playwrightRequest} from '@playwright/test';
import 'dotenv/config';

const CONTAINER_NAME = 'equipment-e2e-postgres';
const BACKEND_PORT = 8080;
const FRONTEND_PORT = 5173;
const STATE_FILE = path.join(os.tmpdir(), 'equipment-e2e-state.json');

export const ADMIN_EMAIL = 'admin@example.com';
export const ADMIN_PASSWORD = 'password';
export const STORAGE_STATE_FILE = path.resolve(__dirname, 'auth.json');

function run(command: string, args: string[], options?: { cwd?: string; env?: NodeJS.ProcessEnv }): Promise<string> {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {stdio: ['ignore', 'pipe', 'pipe'], ...options});
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

function startProcess(command: string, args: string[], options?: {
    cwd?: string;
    env?: NodeJS.ProcessEnv
}, label?: string): Promise<number> {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            stdio: ['ignore', 'pipe', 'pipe'],
            detached: true,
            ...options,
        });
        const prefix = label ? `[${label}] ` : '';
        child.stdout.on('data', (data: Buffer) => {
            process.stdout.write(prefix + data.toString().replace(/\n(?=.)/g, '\n' + prefix));
        });
        child.stderr.on('data', (data: Buffer) => {
            process.stderr.write(prefix + data.toString().replace(/\n(?=.)/g, '\n' + prefix));
        });
        child.on('error', reject);
        child.on('spawn', () => {
            child.unref();
            resolve(child.pid!);
        });
    });
}

async function waitForHttp(url: string, pid: number, maxAttempts: number = 10, intervalMs: number = 1000): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
        try {
            // signal 0 just tests if the pid is valid. it only throws if the process is not running.
            process.kill(pid, 0);
        } catch {
            throw new Error(`Process ${pid} exited before ${url} became ready`);
        }
        try {
            const response = await new Promise<http.IncomingMessage>((resolve, reject) => {
                const req = http.get(url, (res) => {
                    res.resume();
                    resolve(res);
                });
                req.on('error', reject);
                req.setTimeout(2000, () => {
                    req.destroy();
                    reject(new Error('Timeout'));
                });
            });
            if (response.statusCode && response.statusCode < 500) {
                return;
            }
        } catch {
            // Not ready yet
        }
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    throw new Error(`HTTP endpoint ${url} did not become ready within ${maxAttempts} seconds`);
}

export default async function globalSetup() {
    // Remove any leftover container from a crashed previous run.
    try {
        await run('docker', ['rm', '-f', CONTAINER_NAME]);
    } catch {
        // Container likely didn't exist; safe to ignore.
    }

    // Start the Postgres container.
    await run('docker', [
        'run',
        '-d',
        '--name', CONTAINER_NAME,
        '-e', 'POSTGRES_PASSWORD=postgres',
        '-e', 'POSTGRES_USER=postgres',
        '-e', 'POSTGRES_DB=test',
        '-p', '15432:5432',
        'postgres:18',
    ]);

    // Wait for Postgres to accept connections.
    let ready = false;
    for (let i = 0; i < 30; i++) {
        try {
            await run('docker', ['exec', CONTAINER_NAME, 'pg_isready', '-U', 'postgres']);
            ready = true;
            break;
        } catch {
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
    }

    if (!ready) {
        throw new Error('Postgres container did not become ready within 30 seconds');
    }

    // Set environment variables for backend and tests.
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:15432/test';
    process.env.POSTGRES_DB = 'jdbc:postgresql://localhost:15432/test';
    process.env.POSTGRES_USER = 'postgres';
    process.env.POSTGRES_PASSWORD = 'postgres';

    // these are set by a .env file
    // process.env.APP_JWT_SECRET = ""; // 32 random characters
    // process.env.SPRING_MAIL_USERNAME = ""; // from address
    // process.env.SPRING_MAIL_PASSWORD = ""; // Gmail app password

    // Start the backend and frontend in parallel.
    const [backendPid, frontendPid] = await Promise.all([
        startProcess('./mvnw', ['spring-boot:run'], {
            cwd: path.resolve(__dirname, '../backend'),
            env: {...process.env},
        }, 'backend'),
        startProcess('npm', ['run', 'dev'], {
            cwd: path.resolve(__dirname, '../frontend'),
            env: {...process.env},
        }, 'frontend'),
    ]);

    // Wait for both services to be ready.
    await Promise.all([
        waitForHttp(`http://localhost:${BACKEND_PORT}/actuator/health`, backendPid),
        waitForHttp(`http://localhost:${FRONTEND_PORT}`, frontendPid),
    ]);

    // Persist PIDs so teardown can shut the services down.
    fs.writeFileSync(STATE_FILE, JSON.stringify({backendPid, frontendPid}));

    // Seed the admin user via the setup API and save an authenticated storageState
    // so tests can opt into a logged-in browser context without paying the login cost.
    const apiContext = await playwrightRequest.newContext({
        baseURL: `http://localhost:${BACKEND_PORT}`,
    });

    const setupResp = await apiContext.post('/api/v1/setup', {
        data: {email: ADMIN_EMAIL, password: ADMIN_PASSWORD},
        headers: {'Content-Type': 'application/json'},
    });
    if (!setupResp.ok()) {
        throw new Error(`Admin seed failed: ${setupResp.status()} ${await setupResp.text()}`);
    }

    // The setup endpoint sets access_token + refresh_token cookies on the response.
    // Save the cookie jar against the frontend origin so the SPA reads them on first paint.
    const state = await apiContext.storageState();
    state.cookies = state.cookies.map((c) => ({
        ...c,
        domain: 'localhost',
        path: '/',
    }));
    fs.writeFileSync(STORAGE_STATE_FILE, JSON.stringify(state, null, 2));
    await apiContext.dispose();
}
