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

export default async function globalTeardown() {
    try {
        await run('docker', ['rm', '-f', CONTAINER_NAME]);
    } catch {
        // If the container is already gone, nothing to do.
    }
}
