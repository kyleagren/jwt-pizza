import { test, expect } from './testSetup';
import { basicInit } from './helpers';

test('login', async ({ page }) => {
  await basicInit(page);
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('d@jwt.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('a');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page.getByRole('link', { name: 'KC' })).toBeVisible();
});

test('rejects invalid login', async ({ page }) => {
  await basicInit(page);
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('d@jwt.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('wrong');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page.getByText(/401/)).toBeVisible();
});

test('registers a new diner', async ({ page }) => {
  await basicInit(page);
  await page.getByRole('link', { name: 'Register' }).click();
  await page.getByPlaceholder('Full name').fill('New Diner');
  await page.getByPlaceholder('Email address').fill('new@jwt.com');
  await page.getByPlaceholder('Password').fill('secret');
  await page.getByRole('button', { name: 'Register' }).click();

  await expect(page.getByRole('link', { name: 'ND' })).toBeVisible();
});

test('shows empty order history', async ({ page }) => {
  await basicInit(page);
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('d@jwt.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('a');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.getByRole('link', { name: 'KC' }).click();

  await expect(page.getByText(/How have you lived this long/)).toBeVisible();
});

test('can cancel payment and return to the menu', async ({ page }) => {
  await basicInit(page);
  await page.getByRole('button', { name: 'Order now' }).click();
  await page.getByRole('combobox').selectOption('4');
  await page.getByRole('link', { name: 'Image Description Veggie A' }).click();
  await page.getByRole('button', { name: 'Checkout' }).click();

  await page.getByPlaceholder('Email address').fill('d@jwt.com');
  await page.getByPlaceholder('Password').fill('a');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();

  await expect(page.locator('h2')).toContainText('Awesome is a click away');
  await expect(page.locator('form')).toContainText('Selected pizzas: 1');
});

test('purchase with login', async ({ page }) => {
  await basicInit(page);

  await page.getByRole('button', { name: 'Order now' }).click();

  await expect(page.locator('h2')).toContainText('Awesome is a click away');
  await page.getByRole('combobox').selectOption('4');
  await page.getByRole('link', { name: 'Image Description Veggie A' }).click();
  await page.getByRole('link', { name: 'Image Description Pepperoni' }).click();
  await expect(page.locator('form')).toContainText('Selected pizzas: 2');
  await page.getByRole('button', { name: 'Checkout' }).click();

  await page.getByPlaceholder('Email address').fill('d@jwt.com');
  await page.getByPlaceholder('Password').fill('a');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page.getByRole('main')).toContainText(
    'Send me those 2 pizzas right now!',
  );
  await expect(page.locator('tbody')).toContainText('Veggie');
  await expect(page.locator('tbody')).toContainText('Pepperoni');
  await expect(page.locator('tfoot')).toContainText('0.008 ₿');
  await page.getByRole('button', { name: 'Pay now' }).click();

  await expect(page.getByText('0.008')).toBeVisible();
  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(page.getByText('valid', { exact: true })).toBeVisible();
});

test('admin can create a franchise', async ({ page }) => {
  await basicInit(page);
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByPlaceholder('Email address').fill('a@jwt.com');
  await page.getByPlaceholder('Password').fill('test');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.getByRole('link', { name: 'Admin' }).click();
  await page.getByRole('button', { name: 'Add Franchise' }).click();

  await page.getByPlaceholder('franchise name').fill('New Pizza Place');
  await page
    .getByPlaceholder('franchisee admin email')
    .fill('d@jwt.com');
  await page.getByRole('button', { name: 'Create' }).click();

  await expect(
    page.getByRole('cell', { name: 'New Pizza Place' }),
  ).toBeVisible();
});

test('franchisee can create a store', async ({ page }) => {
  await basicInit(page);
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByPlaceholder('Email address').fill('f@jwt.com');
  await page.getByPlaceholder('Password').fill('franchise');
  await page.getByRole('button', { name: 'Login' }).click();
  await page
    .getByRole('navigation', { name: 'Global' })
    .getByRole('link', { name: 'Franchise' })
    .click();

  await expect(
    page.getByRole('heading', { name: 'LotaPizza', level: 2 }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Create store' }).click();
  await page.getByPlaceholder('store name').fill('Provo');
  await page.getByRole('button', { name: 'Create' }).click();

  await expect(page.getByRole('cell', { name: 'Provo' })).toBeVisible();
});

test('login as admin and delete franchise', async ({ page }) => {
  await basicInit(page);
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('a@jwt.com');
  await page.getByRole('textbox', { name: 'Email address' }).press('Tab');
  await page.getByRole('textbox', { name: 'Password' }).fill('test');
  await page.getByRole('textbox', { name: 'Password' }).press('Enter');
  await expect(page.getByRole('link', { name: 'Admin' })).toBeVisible();
  await expect(page.getByRole('link', { name: '常' })).toBeVisible();
  await page.getByRole('link', { name: '常' }).click();
  await page.getByRole('link', { name: 'Admin' }).click();
  await expect(page.getByRole('cell', { name: 'LotaPizza' })).toBeVisible();
  await page
    .getByRole('row', { name: 'LotaPizza Close' })
    .getByRole('button')
    .click();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('cell', { name: 'LotaPizza' })).not.toBeVisible();
  await page.getByRole('link', { name: 'Logout' }).click();
  await expect(page.getByRole('link', { name: 'Login' })).toBeVisible();
});
