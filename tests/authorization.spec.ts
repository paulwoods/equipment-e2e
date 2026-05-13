import {test, expect, uniqueEmail} from '../fixtures';

const seedUserRoleUser = async (
    authedPage: import('@playwright/test').Page,
): Promise<{email: string; password: string}> => {
    const email = uniqueEmail('non-admin');
    const password = 'a-strong-password';

    await authedPage.goto('/users/new');
    await authedPage.getByTestId('user-name').fill('Read Only');
    await authedPage.getByTestId('user-email').fill(email);
    await authedPage.getByTestId('user-password').fill(password);
    // Default role is USER; leave checkboxes alone — that's exactly what we want.
    await Promise.all([
        authedPage.waitForURL(/\/users$/),
        authedPage.getByRole('button', {name: /create user/i}).click(),
    ]);

    return {email, password};
};

test.describe('authorization for USER role', () => {
    test('USER role can log in and reach the dashboard', async ({authedPage, browser}) => {
        const {email, password} = await seedUserRoleUser(authedPage);

        const userContext = await browser.newContext();
        const userPage = await userContext.newPage();

        await userPage.goto('/login');
        await userPage.getByTestId('email').fill(email);
        await userPage.getByTestId('password').fill(password);
        await Promise.all([
            userPage.waitForResponse((r) => r.url().includes('/api/v1/auth/login') && r.ok()),
            userPage.getByRole('button', {name: /sign in/i}).click(),
        ]);

        await userPage.goto('/dashboard');
        await expect(userPage.getByTestId('page-header')).toHaveText(/Dashboard/);

        await userContext.close();
    });

    test('USER role cannot access /users and is redirected to the dashboard', async ({authedPage, browser}) => {
        const {email, password} = await seedUserRoleUser(authedPage);

        const userContext = await browser.newContext();
        const userPage = await userContext.newPage();

        await userPage.goto('/login');
        await userPage.getByTestId('email').fill(email);
        await userPage.getByTestId('password').fill(password);
        await Promise.all([
            userPage.waitForResponse((r) => r.url().includes('/api/v1/auth/login') && r.ok()),
            userPage.getByRole('button', {name: /sign in/i}).click(),
        ]);

        await userPage.goto('/users');
        await userPage.waitForURL(/\/dashboard$/);
        await expect(userPage.getByTestId('page-header')).toHaveText(/Dashboard/);

        await userContext.close();
    });
});
