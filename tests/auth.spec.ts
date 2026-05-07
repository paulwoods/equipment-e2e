import {test, expect, ADMIN_EMAIL, ADMIN_PASSWORD} from '../fixtures';

test.describe('login', () => {
    test('signs in with valid credentials and can reach the protected dashboard', async ({page}) => {
        await page.goto('/login');

        await page.locator('#email').fill(ADMIN_EMAIL);
        await page.locator('#password').fill(ADMIN_PASSWORD);
        await page.getByRole('button', {name: /sign in/i}).click();

        // After login the app routes to "/" (HomePage). Navigate to the protected
        // /dashboard route to confirm the session cookies are actually authenticating us.
        await page.goto('/dashboard');
        await expect(page.locator('#page-header')).toHaveText(/Dashboard/);
    });

    test('shows an error on wrong password and stays on /login', async ({page}) => {
        await page.goto('/login');

        await page.locator('#email').fill(ADMIN_EMAIL);
        await page.locator('#password').fill('not-the-password');
        await page.getByRole('button', {name: /sign in/i}).click();

        await expect(page.getByText(/invalid username or password/i)).toBeVisible();
        await expect(page).toHaveURL(/\/login$/);
    });
});

test.describe('logout', () => {
    test('signs out from the sidebar user menu and clears the session', async ({authedPage}) => {
        await authedPage.goto('/dashboard');
        await expect(authedPage.locator('#page-header')).toHaveText(/Dashboard/);

        await authedPage.locator('#user-menu').click();
        await authedPage.locator('#logout').click();

        // After logout, hitting a protected route should redirect to /login.
        await authedPage.goto('/dashboard');
        await expect(authedPage).toHaveURL(/\/login/);
    });
});

test.describe('forgot password', () => {
    test('always shows a generic confirmation, even for an unknown email', async ({page}) => {
        await page.goto('/forgot-password');

        await page.locator('#email').fill('nobody-here@example.com');
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
        await page.locator('#newPassword').fill(newPassword);
        await page.locator('#confirmPassword').fill(newPassword);
        await page.getByRole('button', {name: /update password/i}).click();

        await expect(page.getByText(/invalid or expired token/i)).toBeVisible();
    });

    test('blocks submit when passwords do not match', async ({page}) => {
        await page.goto('/reset-password?token=anything');

        await page.locator('#newPassword').fill('password-one');
        await page.locator('#confirmPassword').fill('password-two');
        await page.getByRole('button', {name: /update password/i}).click();

        await expect(page.getByText(/passwords do not match/i)).toBeVisible();
    });
});
