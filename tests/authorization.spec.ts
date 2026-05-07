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

    test('USER role on /users sees the table but not the admin-only actions', async ({authedPage, browser}) => {
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
        await expect(userPage.getByTestId('page-header')).toHaveText(/Users/);

        // The admin-only "New User" button must not be rendered.
        await expect(userPage.getByRole('link', {name: 'New User'})).toHaveCount(0);

        // The user's own row should be visible, but it must NOT have Edit or Delete controls.
        const ownRow = userPage.getByTestId('users-table').getByRole('row', {name: email});
        await expect(ownRow).toBeVisible();
        await expect(ownRow.getByRole('link', {name: 'Edit', exact: true})).toHaveCount(0);
        await expect(ownRow.getByRole('button', {name: 'Delete'})).toHaveCount(0);

        await userContext.close();
    });
});
