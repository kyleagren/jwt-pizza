import { test, expect } from './testSetup';
import { basicInit, editUser, login } from './helpers';

test('updateUser', async ({ page }) => {
  const email = `user${Math.floor(Math.random() * 10000)}@jwt.com`;
  await basicInit(page);
  await page.getByRole('link', { name: 'Register' }).click();
  await page.getByRole('textbox', { name: 'Full name' }).fill('pizza diner');
  await page.getByRole('textbox', { name: 'Email address' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill('diner');
  await page.getByRole('button', { name: 'Register' }).click();

  await page.getByRole('link', { name: 'pd' }).click();

  await expect(page.getByRole('main')).toContainText('pizza diner');

  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page.locator('h3')).toContainText('Edit user');
  await page.getByRole('button', { name: 'Update' }).click();

  await page.waitForSelector('[role="dialog"].hidden', { state: 'attached' });

  await expect(page.getByRole('main')).toContainText('pizza diner');

  // begin TDD with an updateUser test to edit the user's name

  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page.locator('h3')).toContainText('Edit user');
  await page.getByRole('textbox').first().fill('pizza dinerx');
  await page.getByRole('button', { name: 'Update' }).click();

  await page.waitForSelector('[role="dialog"].hidden', { state: 'attached' });

  await expect(page.getByRole('main')).toContainText('pizza dinerx');

  await page.getByRole('link', { name: 'Logout' }).click();
  await page.getByRole('link', { name: 'Login' }).click();

  await page.getByRole('textbox', { name: 'Email address' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill('diner');
  await page.getByRole('button', { name: 'Login' }).click();

  await page.getByRole('link', { name: 'pd' }).click();

  await expect(page.getByRole('main')).toContainText('pizza dinerx');
});

test('diner can change password', async ({ page }) => {
  await basicInit(page);
  await login(page, 'd@jwt.com', 'a');
  await page.getByRole('link', { name: 'KC' }).click();

  await editUser(page, { password: 'newpass' });

  await page.getByRole('link', { name: 'Logout' }).click();

  // the old password should no longer work
  await login(page, 'd@jwt.com', 'a');
  await expect(page.getByText(/401/)).toBeVisible();

  await page.getByRole('textbox', { name: 'Password' }).fill('newpass');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.getByRole('link', { name: 'KC' })).toBeVisible();
});

test('diner can change email', async ({ page }) => {
  await basicInit(page);
  await login(page, 'd@jwt.com', 'a');
  await page.getByRole('link', { name: 'KC' }).click();

  await editUser(page, { email: 'kai@jwt.com' });
  await expect(page.getByRole('main')).toContainText('kai@jwt.com');

  await page.getByRole('link', { name: 'Logout' }).click();

  // the old email should no longer work
  await login(page, 'd@jwt.com', 'a');
  await expect(page.getByText(/401/)).toBeVisible();

  await page
    .getByRole('textbox', { name: 'Email address' })
    .fill('kai@jwt.com');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.getByRole('link', { name: 'KC' }).click();
  await expect(page.getByRole('main')).toContainText('kai@jwt.com');
});

test('admin can update their user info', async ({ page }) => {
  await basicInit(page);
  await login(page, 'a@jwt.com', 'test');
  await page.getByRole('link', { name: '常' }).click();
  await expect(page.getByRole('main')).toContainText('admin');

  await editUser(page, {
    name: 'Boss Admin',
    email: 'boss@jwt.com',
    password: 'boss',
  });

  const main = page.getByRole('main');
  await expect(main).toContainText('Boss Admin');
  await expect(main).toContainText('boss@jwt.com');
  await expect(main).toContainText('admin');

  await page.getByRole('link', { name: 'Logout' }).click();
  await login(page, 'boss@jwt.com', 'boss');
  await page.getByRole('link', { name: 'BA' }).click();

  await expect(main).toContainText('Boss Admin');
  await expect(main).toContainText('admin');
});

test('franchisee can update their user info', async ({ page }) => {
  await basicInit(page);
  await login(page, 'f@jwt.com', 'franchise');
  await page.getByRole('link', { name: 'FO' }).click();
  await expect(page.getByRole('main')).toContainText('Franchisee on 2');

  await editUser(page, {
    name: 'Pizza Owner',
    email: 'owner@jwt.com',
    password: 'owner',
  });

  const main = page.getByRole('main');
  await expect(main).toContainText('Pizza Owner');
  await expect(main).toContainText('owner@jwt.com');
  await expect(main).toContainText('Franchisee on 2');

  await page.getByRole('link', { name: 'Logout' }).click();
  await login(page, 'owner@jwt.com', 'owner');
  await page.getByRole('link', { name: 'PO' }).click();

  await expect(main).toContainText('Pizza Owner');
  await expect(main).toContainText('Franchisee on 2');
});

test('admin can list users', async ({ page }) => {
  await basicInit(page);
  await login(page, 'a@jwt.com', 'test');
  await page.getByRole('link', { name: 'Admin' }).click();

  await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();
  const kaiRow = page.getByRole('row', { name: /Kai Chen/ });
  await expect(kaiRow).toContainText('d@jwt.com');
  await expect(kaiRow).toContainText('diner');
  await expect(page.getByRole('row', { name: /Pizza Fan/ })).toBeVisible();

  // only 3 users per page, so the franchisee is on the next page
  await expect(page.getByRole('row', { name: /Franchise Owner/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Next users page' }).click();
  await expect(page.getByRole('row', { name: /Franchise Owner/ })).toContainText('franchisee');
  await expect(kaiRow).toHaveCount(0);

  await page.getByRole('button', { name: 'Previous users page' }).click();
  await expect(kaiRow).toBeVisible();
});

test('admin can filter users', async ({ page }) => {
  await basicInit(page);
  await login(page, 'a@jwt.com', 'test');
  await page.getByRole('link', { name: 'Admin' }).click();

  await page.getByPlaceholder('Filter users').fill('fan');
  await page.getByRole('button', { name: 'Filter users' }).click();

  await expect(page.getByRole('row', { name: /Pizza Fan/ })).toBeVisible();
  await expect(page.getByRole('row', { name: /Kai Chen/ })).toHaveCount(0);
});

test('admin can delete a user', async ({ page }) => {
  await basicInit(page);
  await login(page, 'a@jwt.com', 'test');
  await page.getByRole('link', { name: 'Admin' }).click();

  const kaiRow = page.getByRole('row', { name: /Kai Chen/ });
  await expect(kaiRow).toBeVisible();
  await kaiRow.getByRole('button', { name: 'Delete' }).click();
  await expect(kaiRow).toHaveCount(0);

  // the deleted user can no longer log in
  await page.getByRole('link', { name: 'Logout' }).click();
  await login(page, 'd@jwt.com', 'a');
  await expect(page.getByText(/401/)).toBeVisible();
});
