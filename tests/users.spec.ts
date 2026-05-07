import {test, expect, uniqueEmail} from '../fixtures';

test.describe('users management', () => {
    test('admin creates a new user that appears in the users table', async ({authedPage}) => {
        const email = uniqueEmail('new-user');

        await authedPage.goto('/users');
        await expect(authedPage.getByTestId('page-header')).toHaveText(/Users/);

        await authedPage.getByRole('link', {name: 'New User'}).click();

        await authedPage.getByTestId('user-name').fill('Test User');
        await authedPage.getByTestId('user-email').fill(email);
        await authedPage.getByTestId('user-password').fill('a-strong-password');
        // Default role is USER; leave the checkboxes alone.

        await Promise.all([
            authedPage.waitForURL(/\/users$/),
            authedPage.getByRole('button', {name: /create user/i}).click(),
        ]);

        const row = authedPage.getByTestId('users-table').getByRole('row', {name: email});
        await expect(row).toBeVisible();
        await expect(row).toContainText('Test User');
        await expect(row).toContainText('USER');
    });

    test('admin grants the EDIT role to an existing user', async ({authedPage}) => {
        // Seed a user via the UI so this test owns its own data.
        const email = uniqueEmail('edit-roles');
        await authedPage.goto('/users/new');
        await authedPage.getByTestId('user-name').fill('Edit Target');
        await authedPage.getByTestId('user-email').fill(email);
        await authedPage.getByTestId('user-password').fill('a-strong-password');
        await Promise.all([
            authedPage.waitForURL(/\/users$/),
            authedPage.getByRole('button', {name: /create user/i}).click(),
        ]);

        // Open the row's Edit link.
        const row = authedPage.getByTestId('users-table').getByRole('row', {name: email});
        await row.getByRole('link', {name: 'Edit'}).click();

        await authedPage.getByRole('button', {name: 'Roles'}).click();
        await authedPage.getByLabel('EDIT').check();

        await Promise.all([
            authedPage.waitForURL(/\/users$/),
            authedPage.getByRole('button', {name: /save changes/i}).click(),
        ]);

        const updatedRow = authedPage.getByTestId('users-table').getByRole('row', {name: email});
        await expect(updatedRow).toContainText('EDIT');
    });

    test('admin deletes a user and the row disappears', async ({authedPage}) => {
        const email = uniqueEmail('delete-target');
        await authedPage.goto('/users/new');
        await authedPage.getByTestId('user-name').fill('Delete Target');
        await authedPage.getByTestId('user-email').fill(email);
        await authedPage.getByTestId('user-password').fill('a-strong-password');
        await Promise.all([
            authedPage.waitForURL(/\/users$/),
            authedPage.getByRole('button', {name: /create user/i}).click(),
        ]);

        const row = authedPage.getByTestId('users-table').getByRole('row', {name: email});
        await expect(row).toBeVisible();

        // The Delete handler triggers a native confirm() — auto-accept it.
        authedPage.once('dialog', (dialog) => dialog.accept());
        await row.getByRole('button', {name: 'Delete'}).click();

        await expect(row).toHaveCount(0);
    });
});
