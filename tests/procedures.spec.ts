import {test, expect} from '../fixtures';
import type {Page} from '@playwright/test';

const uniqueSuffix = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

const seedEquipment = async (page: Page, modelNumber: string): Promise<void> => {
    await page.goto('/equipment/new');
    await page.getByLabel('Manufacturer').fill('ProcCo');
    await page.getByLabel('Model Number').fill(modelNumber);
    await Promise.all([
        page.waitForURL(/\/equipment$/),
        page.getByRole('button', {name: 'Create'}).click(),
    ]);
};

const openProceduresFor = async (page: Page, modelNumber: string): Promise<void> => {
    await page.goto('/equipment');
    const row = page.getByRole('row', {name: new RegExp(modelNumber)});
    await row.getByRole('link', {name: 'View'}).click();
    await page.waitForURL(/\/equipment\/[^/]+\/procedures$/);
};

// SimpleMDE renders a CodeMirror editor. The form has two of them, in this order:
// index 0 = Required Tools / PPE, index 1 = Procedure Steps. Click + type is the
// most reliable way to populate them — direct value setting fights the editor.
const fillProcedureForm = async (
    page: Page,
    fields: {name: string; intervalDays: number; steps: string},
): Promise<void> => {
    await page.getByLabel('Name').fill(fields.name);
    await page.getByLabel('Interval (Days)').fill(String(fields.intervalDays));
    await page.locator('.CodeMirror').nth(1).click();
    await page.keyboard.type(fields.steps);
};

test.describe('procedures', () => {
    test('admin adds a procedure to an equipment item and it appears in the list', async ({authedPage}) => {
        const modelNumber = `MODEL-${uniqueSuffix()}`;
        const procedureName = `Calibration ${uniqueSuffix()}`;

        await seedEquipment(authedPage, modelNumber);
        await openProceduresFor(authedPage, modelNumber);

        await authedPage.getByRole('link', {name: 'Add Procedure'}).click();
        await fillProcedureForm(authedPage, {name: procedureName, intervalDays: 30, steps: 'Step 1'});

        await Promise.all([
            authedPage.waitForURL(/\/equipment\/[^/]+\/procedures$/),
            authedPage.getByRole('button', {name: 'Create', exact: true}).click(),
        ]);

        const row = authedPage.getByRole('row', {name: new RegExp(procedureName)});
        await expect(row).toBeVisible();
        await expect(row).toContainText('30');
    });

    test('performing a procedure records an entry visible on the history page', async ({authedPage}) => {
        const modelNumber = `MODEL-${uniqueSuffix()}`;
        const procedureName = `Inspection ${uniqueSuffix()}`;
        const notes = `e2e perform notes ${uniqueSuffix()}`;

        await seedEquipment(authedPage, modelNumber);
        await openProceduresFor(authedPage, modelNumber);

        // Add the procedure.
        await authedPage.getByRole('link', {name: 'Add Procedure'}).click();
        await fillProcedureForm(authedPage, {name: procedureName, intervalDays: 7, steps: 'Step 1'});
        await Promise.all([
            authedPage.waitForURL(/\/equipment\/[^/]+\/procedures$/),
            authedPage.getByRole('button', {name: 'Create', exact: true}).click(),
        ]);

        const procRow = authedPage.getByRole('row', {name: new RegExp(procedureName)});
        await procRow.getByRole('link', {name: 'Perform'}).click();
        await authedPage.waitForURL(/\/perform$/);

        // Date defaults to today; fill notes only.
        await authedPage.getByPlaceholder(/notes about this performance/i).fill(notes);

        // Recording navigates to /dashboard.
        await Promise.all([
            authedPage.waitForURL(/\/dashboard$/),
            authedPage.getByRole('button', {name: /record performance/i}).click(),
        ]);

        // Walk back to the procedures list and open History for our procedure.
        await openProceduresFor(authedPage, modelNumber);
        await authedPage
            .getByRole('row', {name: new RegExp(procedureName)})
            .getByRole('link', {name: 'History'})
            .click();
        await authedPage.waitForURL(/\/history$/);

        await expect(authedPage.getByText(notes).first()).toBeVisible();
    });
});
