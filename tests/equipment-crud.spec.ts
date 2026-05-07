import {test, expect} from '../fixtures';

const uniqueModel = (prefix: string): string =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

const fillEquipmentForm = async (
    page: import('@playwright/test').Page,
    fields: {manufacturer: string; modelNumber: string; location?: string},
): Promise<void> => {
    await page.getByLabel('Manufacturer').fill(fields.manufacturer);
    await page.getByLabel('Model Number').fill(fields.modelNumber);
    if (fields.location !== undefined) {
        await page.getByLabel('Location').fill(fields.location);
    }
    // Manufacturer + Model + Purchase Date (defaulted to today) are all that's required.
};

test.describe('equipment CRUD', () => {
    test('admin creates equipment and it appears in the list', async ({authedPage}) => {
        const modelNumber = uniqueModel('CREATE');

        await authedPage.goto('/equipment');
        await expect(authedPage.getByTestId('page-header')).toHaveText('Equipment');

        await authedPage.getByRole('link', {name: 'Add Equipment'}).click();
        await fillEquipmentForm(authedPage, {manufacturer: 'Acme', modelNumber, location: 'Lab A'});

        await Promise.all([
            authedPage.waitForURL(/\/equipment$/),
            authedPage.getByRole('button', {name: 'Create'}).click(),
        ]);

        const row = authedPage.getByRole('row', {name: new RegExp(modelNumber)});
        await expect(row).toBeVisible();
        await expect(row).toContainText('Acme');
        await expect(row).toContainText('Lab A');
    });

    test('clicking a model number opens the equipment show page', async ({authedPage}) => {
        const modelNumber = uniqueModel('SHOW');

        // Seed via UI.
        await authedPage.goto('/equipment/new');
        await fillEquipmentForm(authedPage, {manufacturer: 'ShowCo', modelNumber});
        await Promise.all([
            authedPage.waitForURL(/\/equipment$/),
            authedPage.getByRole('button', {name: 'Create'}).click(),
        ]);

        await authedPage.getByRole('link', {name: modelNumber}).click();
        await authedPage.waitForURL(/\/equipment\/[^/]+$/);
        await expect(authedPage.getByRole('heading', {name: modelNumber, level: 1})).toBeVisible();
        await expect(authedPage.getByText('ShowCo')).toBeVisible();
    });

    test('admin edits equipment location and the change persists in the list', async ({authedPage}) => {
        const modelNumber = uniqueModel('EDIT');

        await authedPage.goto('/equipment/new');
        await fillEquipmentForm(authedPage, {manufacturer: 'EditCo', modelNumber, location: 'Old Lab'});
        await Promise.all([
            authedPage.waitForURL(/\/equipment$/),
            authedPage.getByRole('button', {name: 'Create'}).click(),
        ]);

        const row = authedPage.getByRole('row', {name: new RegExp(modelNumber)});
        await row.getByRole('link', {name: 'Edit', exact: true}).click();

        await authedPage.getByLabel('Location').fill('New Lab');
        await Promise.all([
            authedPage.waitForURL(/\/equipment$/),
            authedPage.getByRole('button', {name: 'Update'}).click(),
        ]);

        const updatedRow = authedPage.getByRole('row', {name: new RegExp(modelNumber)});
        await expect(updatedRow).toContainText('New Lab');
        await expect(updatedRow).not.toContainText('Old Lab');
    });

    test('admin deletes equipment and the row disappears', async ({authedPage}) => {
        const modelNumber = uniqueModel('DELETE');

        await authedPage.goto('/equipment/new');
        await fillEquipmentForm(authedPage, {manufacturer: 'DeleteCo', modelNumber});
        await Promise.all([
            authedPage.waitForURL(/\/equipment$/),
            authedPage.getByRole('button', {name: 'Create'}).click(),
        ]);

        const row = authedPage.getByRole('row', {name: new RegExp(modelNumber)});
        await expect(row).toBeVisible();

        authedPage.once('dialog', (dialog) => dialog.accept());
        await row.getByRole('button', {name: 'Delete'}).click();

        await expect(row).toHaveCount(0);
    });
});
