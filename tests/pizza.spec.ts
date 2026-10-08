import { Page } from '@playwright/test';
import { test, expect } from './testSetup';
import { Role, User } from '../src/service/pizzaService';

async function basicInit(page: Page) {
  let loggedInUser: User | undefined;
  const validUsers: Record<string, User> = {
    'a@jwt.com': {
      id: '1',
      name: '常',
      email: 'a@jwt.com',
      password: 'test',
      roles: [{ role: Role.Admin }],
    },
    'd@jwt.com': {
      id: '3',
      name: 'Kai Chen',
      email: 'd@jwt.com',
      password: 'a',
      roles: [{ role: Role.Diner }],
    },
    'f@jwt.com': {
      id: '4',
      name: 'Franchise Owner',
      email: 'f@jwt.com',
      password: 'franchise',
      roles: [{ role: Role.Franchisee, objectId: '2' }],
    },
  };

  await page.route('*/**/api/auth', async (route) => {
    const method = route.request().method();

    if (method === 'DELETE') {
      await route.fulfill({ json: { message: 'logout successful' } });
      return;
    }

    const loginReq = route.request().postDataJSON();

    if (method === 'POST') {
      const newUser: User = {
        id: '5',
        name: loginReq.name,
        email: loginReq.email,
        password: loginReq.password,
        roles: [{ role: Role.Diner }],
      };
      validUsers[newUser.email!] = newUser;
      loggedInUser = newUser;
      await route.fulfill({ json: { user: newUser, token: 'abcdef' } });
      return;
    }

    const user = validUsers[loginReq.email];
    if (!user || user.password !== loginReq.password) {
      await route.fulfill({ status: 401, json: { error: 'Unauthorized' } });
      return;
    }
    loggedInUser = validUsers[loginReq.email];
    const loginRes = {
      user: loggedInUser,
      token: 'abcdef',
    };
    expect(method).toBe('PUT');
    await route.fulfill({ json: loginRes });
  });

  await page.route('*/**/api/user/me', async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: loggedInUser });
  });

  await page.route('*/**/api/order/menu', async (route) => {
    const menuRes = [
      {
        id: 1,
        title: 'Veggie',
        image: 'pizza1.png',
        price: 0.0038,
        description: 'A garden of delight',
      },
      {
        id: 2,
        title: 'Pepperoni',
        image: 'pizza2.png',
        price: 0.0042,
        description: 'Spicy treat',
      },
    ];
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: menuRes });
  });

  const franchiseRes = {
    franchises: [
      {
        id: 2,
        name: 'LotaPizza',
        stores: [
          { id: 4, name: 'Lehi' },
          { id: 5, name: 'Springville' },
          { id: 6, name: 'American Fork' },
        ],
      },
      { id: 3, name: 'PizzaCorp', stores: [{ id: 7, name: 'Spanish Fork' }] },
      { id: 4, name: 'topSpot', stores: [] },
    ],
  };
  const franchiseeRes = {
    id: 2,
    name: 'LotaPizza',
    stores: [{ id: 4, name: 'Lehi', totalRevenue: 0 }],
  };

  await page.route(/\/api\/franchise(?:\/\d+)?(?:\/store)?(?:\?.*)?$/, async (route) => {
    const path = new URL(route.request().url()).pathname;

    if (route.request().method() === 'GET' && path !== '/api/franchise') {
      await route.fulfill({ json: [franchiseeRes] });
      return;
    }

    if (route.request().method() === 'POST') {
      if (path.endsWith('/store')) {
        const store = {
          ...route.request().postDataJSON(),
          id: 8,
          totalRevenue: 0,
        };
        franchiseeRes.stores.push(store);
        await route.fulfill({ json: store });
        return;
      }

      const franchiseReq = route.request().postDataJSON();
      const newFranchise = {
        ...franchiseReq,
        id: 5,
        stores: [],
      };
      franchiseRes.franchises.push(newFranchise);
      await route.fulfill({ json: newFranchise });
      return;
    }

    if (route.request().method() === 'DELETE') {
      const franchiseId = Number(
        new URL(route.request().url()).pathname.split('/').pop(),
      );
      franchiseRes.franchises = franchiseRes.franchises.filter(
        (franchise) => franchise.id !== franchiseId,
      );
      await route.fulfill({ json: { message: 'franchise deleted' } });
      return;
    }

    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: franchiseRes });
  });

  await page.route('*/**/api/order', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        json: {
          dinerId: loggedInUser?.id,
          orders: [],
          page: 1,
        },
      });
      return;
    }

    const orderReq = route.request().postDataJSON();
    const orderRes = {
      order: { ...orderReq, id: 23 },
      jwt: 'eyJpYXQ',
    };
    expect(route.request().method()).toBe('POST');
    await route.fulfill({ json: orderRes });
  });

  await page.route('https://pizza-factory.cs329.click/api/order/verify', async (route) => {
    expect(route.request().method()).toBe('POST');
    await route.fulfill({
      json: { message: 'valid', payload: 'order verified' },
    });
  });

  await page.goto('/');
}

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
  await expect(page.getByText('valid')).toBeVisible();
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

  await expect(page.locator('h2')).toContainText('LotaPizza');
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
