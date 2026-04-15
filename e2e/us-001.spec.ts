import {expect, test} from '@playwright/test';

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:8080';
const TEST_EMAIL = 'admin@e2e-test.example.com';
const TEST_PASSWORD = 'e2eTestPassword123!';

test.describe('US-001 – Initial Admin Setup', () => {
    test.describe.configure({mode: 'serial'});

    test.beforeEach(async ({request}) => {
        await request.delete(`${API_URL}/api/test/reset`);
        const statusRes = await request.get(`${API_URL}/api/setup/status`);
        const status = await statusRes.json();
        expect(status.setupRequired).toBe(true);
    });

    test('AC-1: navigating to /login redirects to /setup when no users exist', async ({page}) => {
        await page.goto('/login');
        await expect(page).toHaveURL('/setup');
    });

    test('AC-2: setup page renders email and password inputs', async ({page}) => {
        await page.goto('/setup');
        await expect(page.locator('#email')).toBeVisible();
        await expect(page.locator('#password')).toBeVisible();
        await expect(page.getByRole('button', {name: 'Create admin account'})).toBeVisible();
    });

    test('AC-3+4: submitting setup form creates admin user and redirects to /dashboard', async ({page, request}) => {
        await page.goto('/setup');
        await page.locator('#email').fill(TEST_EMAIL);
        await page.locator('#password').fill(TEST_PASSWORD);
        await page.getByRole('button', {name: 'Create admin account'}).click();

        await expect(page).toHaveURL('/dashboard');

        const statusRes = await request.get(`${API_URL}/api/setup/status`);
        const status = await statusRes.json();
        expect(status.setupRequired).toBe(false);
    });

    test('AC-5: navigating to /setup redirects to /login when admin account already exists', async ({
                                                                                                        page,
                                                                                                        request
                                                                                                    }) => {
        await request.post(`${API_URL}/api/setup`, {
            data: {email: TEST_EMAIL, password: TEST_PASSWORD},
        });

        await page.goto('/setup');
        await expect(page).toHaveURL('/login');
    });

    test('error state: shows error message when setup request fails', async ({page}) => {
        await page.route('**/api/setup/status', (route) => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({setupRequired: true}),
            });
        });
        await page.route('**/api/setup', (route) => {
            if (route.request().method() === 'POST') {
                route.fulfill({status: 500, body: 'Internal Server Error'});
            } else {
                route.continue();
            }
        });

        await page.goto('/setup');
        await page.locator('#email').fill(TEST_EMAIL);
        await page.locator('#password').fill(TEST_PASSWORD);
        await page.getByRole('button', {name: 'Create admin account'}).click();

        await expect(page.getByText('Setup failed. Please try again.')).toBeVisible();
    });
});
