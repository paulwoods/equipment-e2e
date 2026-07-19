import {test as base, expect, type Page} from '@playwright/test';
import * as path from 'path';

export const ADMIN_EMAIL = 'admin@example.com';
export const ADMIN_PASSWORD = 'password';

const STORAGE_STATE_FILE = path.resolve(__dirname, 'auth.json');

type Fixtures = {
    authedPage: Page;
};

export const test = base.extend<Fixtures>({
    /**
     * A browser context authenticated as the SHARED admin seeded in global-setup.
     *
     * Every spec runs as this one identity, in parallel. Anything that invalidates
     * the user's sessions server-side — logging out, changing the password, a
     * password reset — bumps `tokenVersion` and kills this session for every other
     * worker mid-run, which surfaces as unrelated specs redirecting to /login.
     *
     * If a test needs to perform one of those actions, have it create its own user
     * and act as that identity instead (see the logout test in auth.spec.ts).
     */
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
