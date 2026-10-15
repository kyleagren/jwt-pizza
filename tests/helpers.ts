import { Page } from '@playwright/test';
import { expect } from './testSetup';
import { Role, User } from '../src/service/pizzaService';

export async function basicInit(page: Page) {
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

  await page.route(/\/api\/user\/\d+$/, async (route) => {
    expect(route.request().method()).toBe('PUT');
    const id = new URL(route.request().url()).pathname.split('/').pop();
    const updateReq = route.request().postDataJSON();
    const user = Object.values(validUsers).find((u) => u.id === id);
    if (!user) {
      await route.fulfill({ status: 404, json: { error: 'unknown user' } });
      return;
    }

    // re-key by email so later logins must use the updated email
    delete validUsers[user.email!];
    user.name = updateReq.name;
    user.email = updateReq.email;
    if (updateReq.password) {
      user.password = updateReq.password;
    }
    validUsers[user.email!] = user;
    loggedInUser = user;
    await route.fulfill({ json: { user, token: 'abcdef' } });
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

  await page.route('**/api/franchise/4', async (route) => {
    await route.fulfill({ json: [franchiseeRes] });
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

  await page.route('**/api/order/verify', async (route) => {
    expect(route.request().method()).toBe('POST');
    await route.fulfill({
      json: { message: 'valid', payload: 'order verified' },
    });
  });

  await page.goto('/');
}

export async function login(page: Page, email: string, password: string) {
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
}

export async function editUser(
  page: Page,
  changes: { name?: string; email?: string; password?: string },
) {
  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page.locator('h3')).toContainText('Edit user');
  const dialog = page.getByRole('dialog');
  if (changes.name !== undefined) {
    await dialog.getByRole('textbox').nth(0).fill(changes.name);
  }
  if (changes.email !== undefined) {
    await dialog.getByRole('textbox').nth(1).fill(changes.email);
  }
  if (changes.password !== undefined) {
    await dialog.locator('#password').fill(changes.password);
  }
  await page.getByRole('button', { name: 'Update' }).click();
  await page.waitForSelector('[role="dialog"].hidden', { state: 'attached' });
}
