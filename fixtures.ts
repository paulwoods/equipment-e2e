import {test as base, expect, type Page} from '@playwright/test';
import * as path from 'path';

export const ADMIN_EMAIL = 'admin@example.com';
export const ADMIN_PASSWORD = 'password';

const STORAGE_STATE_FILE = path.resolve(__dirname, 'auth.json');

type Fixtures = {
    authedPage: Page;
};

export const test = base.extend<Fixtures>({
    authedPage: async ({browser}, use) => {
        const context = await browser.newContext({storageState: STORAGE_STATE_FILE});
        const page = await context.newPage();
        await use(page);
        await context.close();
    },
});

export {expect};

/**
 * Returns a unique-per-call email so tests creating users in parallel don't collide.
 * Pair with strategy B: each test creates its own data instead of resetting the DB.
 */
export const uniqueEmail = (prefix = 'user'): string =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
