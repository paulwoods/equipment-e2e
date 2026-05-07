import {test, expect} from '../fixtures';

const uniqueSuffix = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

test.describe('equipment import', () => {
    test('uploading a JSON file imports equipment and procedures', async ({authedPage}) => {
        const suffix = uniqueSuffix();
        const modelA = `IMPORT-A-${suffix}`;
        const modelB = `IMPORT-B-${suffix}`;

        const payload = [
            {
                manufacturer: 'ImportCo',
                modelNumber: modelA,
                location: 'Imported Lab',
                status: 'Active',
                purchaseDate: '2025-01-01',
                procedures: [
                    {
                        name: 'Yearly Check',
                        steps: 'Do the yearly check',
                        intervalDays: 365,
                        history: [],
                    },
                ],
            },
            {
                manufacturer: 'ImportCo',
                modelNumber: modelB,
                status: 'Active',
                purchaseDate: '2025-01-01',
                procedures: [],
            },
        ];

        await authedPage.goto('/equipment/import');

        await authedPage.locator('input[type="file"]').setInputFiles({
            name: 'equipment.json',
            mimeType: 'application/json',
            buffer: Buffer.from(JSON.stringify(payload), 'utf-8'),
        });

        await authedPage.getByRole('button', {name: /^Import$/}).click();

        // Success panel reports counts.
        await expect(authedPage.getByText(/Import successful/i)).toBeVisible();
        await expect(authedPage.getByText(/2 equipment imported/i)).toBeVisible();
        await expect(authedPage.getByText(/1 procedures imported/i)).toBeVisible();

        await authedPage.getByRole('link', {name: 'View Equipment'}).click();
        await authedPage.waitForURL(/\/equipment$/);

        await expect(authedPage.getByRole('row', {name: new RegExp(modelA)})).toBeVisible();
        await expect(authedPage.getByRole('row', {name: new RegExp(modelB)})).toBeVisible();
    });

    test('uploading an invalid JSON file shows an error', async ({authedPage}) => {
        await authedPage.goto('/equipment/import');

        await authedPage.locator('input[type="file"]').setInputFiles({
            name: 'broken.json',
            mimeType: 'application/json',
            buffer: Buffer.from('this is not json', 'utf-8'),
        });

        await authedPage.getByRole('button', {name: /^Import$/}).click();

        await expect(authedPage.getByText(/status code 400|invalid json/i)).toBeVisible();
    });
});
