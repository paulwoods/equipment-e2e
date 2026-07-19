import {test, expect, ADMIN_EMAIL, ADMIN_PASSWORD, uniqueEmail} from '../fixtures';

test.describe('login', () => {
    test('signs in with valid credentials and can reach the protected dashboard', async ({page}) => {
        await page.goto('/login');

        await page.getByTestId('email').fill(ADMIN_EMAIL);
        await page.getByTestId('password').fill(ADMIN_PASSWORD);

        // Wait for the login POST to actually return before we navigate away —
        // otherwise the goto('/dashboard') below can race the auth cookies and
        // the protected route redirects us back to /login.
        await Promise.all([
            page.waitForResponse((res) => res.url().includes('/api/v1/auth/login') && res.ok()),
            page.getByRole('button', {name: /sign in/i}).click(),
        ]);

        // After login the app routes to "/" (HomePage). Navigate to the protected
        // /dashboard route to confirm the session cookies are actually authenticating us.
        await page.goto('/dashboard');
        await expect(page.getByTestId('page-header')).toHaveText(/Dashboard/);
    });

    test('shows an error on wrong password and stays on /login', async ({page}) => {
        await page.goto('/login');

        await page.getByTestId('email').fill(ADMIN_EMAIL);
        await page.getByTestId('password').fill('not-the-password');
        await page.getByRole('button', {name: /sign in/i}).click();

        await expect(page.getByText(/invalid username or password/i)).toBeVisible();
        await expect(page).toHaveURL(/\/login$/);
    });
});

test.describe('logout', () => {
    test('signs out from the sidebar user menu and clears the session', async ({authedPage, browser}) => {
        // Logging out bumps the user's tokenVersion server-side, which invalidates
        // EVERY JWT for that user — not just this browser's. Signing out as the
        // shared admin would therefore kill the auth.json session that every other
        // spec runs on, and with fullyParallel workers that lands mid-test. So sign
        // out as a throwaway user; admin is only borrowed here to create it.
        const email = uniqueEmail('logout');
        const password = 'a-strong-password';

        await authedPage.goto('/users/new');
        await authedPage.getByTestId('user-name').fill('Logout Target');
        await authedPage.getByTestId('user-email').fill(email);
        await authedPage.getByTestId('user-password').fill(password);
        await Promise.all([
            authedPage.waitForURL(/\/users$/),
            authedPage.getByRole('button', {name: /create user/i}).click(),
        ]);

        const context = await browser.newContext();
        const page = await context.newPage();

        await page.goto('/login');
        await page.getByTestId('email').fill(email);
        await page.getByTestId('password').fill(password);
        await Promise.all([
            page.waitForResponse((r) => r.url().includes('/api/v1/auth/login') && r.ok()),
            page.getByRole('button', {name: /sign in/i}).click(),
        ]);

        await page.goto('/dashboard');
        await expect(page.getByTestId('page-header')).toHaveText(/Dashboard/);

        await page.getByTestId('user-menu').click();
        // The logout handler fires window.location.href='/' once the POST resolves; wait for
        // both before navigating, otherwise that redirect races our goto('/dashboard').
        await Promise.all([
            page.waitForResponse((r) => r.url().includes('/api/v1/auth/logout') && r.ok()),
            page.waitForURL(/\/$/),
            page.getByTestId('logout').click(),
        ]);

        // After logout, hitting a protected route should redirect to /login.
        await page.goto('/dashboard');
        await expect(page).toHaveURL(/\/login/);

        await context.close();
    });
});

test.describe('forgot password', () => {
    test('always shows a generic confirmation, even for an unknown email', async ({page}) => {
        await page.goto('/forgot-password');

        await page.getByTestId('email').fill('nobody-here@example.com');
        await page.getByRole('button', {name: /send reset instructions/i}).click();

        await expect(
            page.getByText(/if your email is registered, you will receive reset instructions/i)
        ).toBeVisible();
    });
});

test.describe('reset password', () => {
    test('rejects an invalid token with a clear error', async ({page}) => {
        await page.goto('/reset-password?token=this-token-does-not-exist');

        const newPassword = 'a-new-password-123';
        await page.getByTestId('newPassword').fill(newPassword);
        await page.getByTestId('confirmPassword').fill(newPassword);
        await page.getByRole('button', {name: /update password/i}).click();

        await expect(page.getByText(/invalid or expired token/i)).toBeVisible();
    });

    test('blocks submit when passwords do not match', async ({page}) => {
        await page.goto('/reset-password?token=anything');

        await page.getByTestId('newPassword').fill('password-one');
        await page.getByTestId('confirmPassword').fill('password-two');
        await page.getByRole('button', {name: /update password/i}).click();

        await expect(page.getByText(/passwords do not match/i)).toBeVisible();
    });
});
