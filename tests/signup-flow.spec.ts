import {expect, test} from '@playwright/test';
import {describe} from "node:test";

describe('signup flow', async () => {

    test('successfully creates the system admin', async ({page}) => {
        // navigate to the homepage
        await page.goto('http://localhost:5173');

        // Expect a title "to contain" a substring.
        await expect(page).toHaveTitle(/Equipment/);

        // click on dashboard
        await page.locator('#dashboard-link').click();

        // we should be on the signup page
        await expect(page.locator('#page-header')).toHaveText("First User Setup");

        // enter email, password. click Create Admin Account
        await page.locator('#email').fill('mr.paul.woods@gmail.com');
        await page.locator('#password').fill('password');
        await page.locator('#create-admin-account').click();

        // verify were on the dashboard page
        await expect(page.locator('#page-header')).toHaveText(/Dashboard/);

        // navigate to the user's page
        await page.locator('#sidebar-users').click();
        await expect(page.locator('#page-header')).toHaveText(/Users/);

        // verify there is only one user
        await expect(page.locator('#users-table tbody tr')).toHaveCount(1);

        await expect(
            page.locator('#users-table tbody tr').first().locator('td').first()
        ).toHaveText('mr.paul.woods@gmail.com');

        await expect(
            page.locator('#users-table tbody tr').first().locator('td').nth(1)
        ).toHaveText('mr.paul.woods@gmail.com');

        // verify the roles cell contains all four expected roles
        const rolesCell = page.locator('#users-table tbody tr').first().locator('td').nth(2);
        await expect(rolesCell).toContainText('SYSTEM_ADMIN');
        await expect(rolesCell).toContainText('ADMIN');
        await expect(rolesCell).toContainText('EDIT');
        await expect(rolesCell).toContainText('USER');
    });

})
