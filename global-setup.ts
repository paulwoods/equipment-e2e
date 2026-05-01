import {spawn} from 'child_process';

const CONTAINER_NAME = 'equipment-e2e-postgres';

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

    // Expose connection details so tests (or a spawned backend) can use them.
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:15432/test';
}
