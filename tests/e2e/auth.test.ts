/**
 * E2E tests — Authentication flows.
 *
 * Tests target the real login (/login) and register (/register) pages.
 * Form field names and selectors match the actual page implementations.
 *
 * Static structure + client-side validation tests run without a backend.
 * Live auth flows (network calls to Supabase) are tagged test.skip for CI.
 */

import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Login page — static structure
// ---------------------------------------------------------------------------

test.describe('Login page — structure', () => {
  test('loads with correct heading', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('Sign in to PokéPlay')).toBeVisible();
  });

  test('has email input', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel('Email')).toBeVisible();
  });

  test('has password input', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel('Password')).toBeVisible();
  });

  test('has sign-in submit button', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('has link to register page', async ({ page }) => {
    await page.goto('/login');
    const link = page.getByRole('link', { name: /register/i });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/register');
  });
});

// ---------------------------------------------------------------------------
// Login page — client-side validation (Zod schema)
// ---------------------------------------------------------------------------

test.describe('Login page — client-side validation', () => {
  test('shows error for invalid email format', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('not-an-email');
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText('Enter a valid email')).toBeVisible();
  });

  test('shows error for password shorter than 6 characters', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('trainer@example.com');
    await page.getByLabel('Password').fill('abc');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText('Password must be at least 6 characters')).toBeVisible();
  });

  test('shows validation error when both fields are empty on submit', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText('Enter a valid email')).toBeVisible();
  });

  test('does not show validation errors before submit', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('Enter a valid email')).not.toBeVisible();
    await expect(page.getByText('Password must be at least 6 characters')).not.toBeVisible();
  });

  test('sign-in button is enabled on page load', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: /sign in/i })).toBeEnabled();
  });
});

// ---------------------------------------------------------------------------
// Register page — static structure
// ---------------------------------------------------------------------------

test.describe('Register page — structure', () => {
  test('loads with correct heading', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByText('Create your account')).toBeVisible();
  });

  test('has username input', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByLabel('Username')).toBeVisible();
  });

  test('has email input', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByLabel('Email')).toBeVisible();
  });

  test('has password input', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByLabel('Password')).toBeVisible();
  });

  test('has confirm password input', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByLabel('Confirm password')).toBeVisible();
  });

  test('has create account submit button', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByRole('button', { name: /create account/i })).toBeVisible();
  });

  test('has link back to sign-in page', async ({ page }) => {
    await page.goto('/register');
    const link = page.getByRole('link', { name: /sign in/i });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/login');
  });
});

// ---------------------------------------------------------------------------
// Register page — client-side validation (Zod schema)
// ---------------------------------------------------------------------------

test.describe('Register page — client-side validation', () => {
  async function fillRegisterForm(
    page: Page,
    opts: { username?: string; email?: string; password?: string; confirm?: string },
  ) {
    await page.goto('/register');
    if (opts.username !== undefined) await page.getByLabel('Username').fill(opts.username);
    if (opts.email !== undefined) await page.getByLabel('Email').fill(opts.email);
    if (opts.password !== undefined) await page.getByLabel('Password').fill(opts.password);
    if (opts.confirm !== undefined) await page.getByLabel('Confirm password').fill(opts.confirm);
    await page.getByRole('button', { name: /create account/i }).click();
  }

  test('shows error for username shorter than 3 characters', async ({ page }) => {
    await fillRegisterForm(page, {
      username: 'ab',
      email: 'trainer@example.com',
      password: 'password123',
      confirm: 'password123',
    });
    await expect(page.getByText('Username must be at least 3 characters')).toBeVisible();
  });

  test('shows error for username longer than 20 characters', async ({ page }) => {
    await fillRegisterForm(page, {
      username: 'a'.repeat(21),
      email: 'trainer@example.com',
      password: 'password123',
      confirm: 'password123',
    });
    await expect(page.getByText('Username must be 20 characters or fewer')).toBeVisible();
  });

  test('shows error for username with special characters (space, !)', async ({ page }) => {
    await fillRegisterForm(page, {
      username: 'ash ketchum!',
      email: 'trainer@example.com',
      password: 'password123',
      confirm: 'password123',
    });
    await expect(page.getByText('Only letters, numbers, and underscores')).toBeVisible();
  });

  test('shows error for invalid email format', async ({ page }) => {
    await fillRegisterForm(page, {
      username: 'AshKetchum',
      email: 'not-an-email',
      password: 'password123',
      confirm: 'password123',
    });
    await expect(page.getByText('Enter a valid email')).toBeVisible();
  });

  test('shows error when passwords do not match', async ({ page }) => {
    await fillRegisterForm(page, {
      username: 'AshKetchum',
      email: 'trainer@example.com',
      password: 'password123',
      confirm: 'different456',
    });
    await expect(page.getByText('Passwords do not match')).toBeVisible();
  });

  test('shows error for password shorter than 6 characters', async ({ page }) => {
    await fillRegisterForm(page, {
      username: 'AshKetchum',
      email: 'trainer@example.com',
      password: 'abc',
      confirm: 'abc',
    });
    await expect(page.getByText('Password must be at least 6 characters')).toBeVisible();
  });

  test('accepts username with underscores and numbers', async ({ page }) => {
    await fillRegisterForm(page, {
      username: 'Ash_1',
      email: 'trainer@example.com',
      password: 'password123',
      confirm: 'password123',
    });
    await expect(page.getByText('Only letters, numbers, and underscores')).not.toBeVisible();
    await expect(page.getByText('Username must be at least 3 characters')).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Navigation between auth pages
// ---------------------------------------------------------------------------

test.describe('Auth — navigation', () => {
  test('Register link on login page goes to /register', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: /register/i }).click();
    await expect(page).toHaveURL('/register');
  });

  test('Sign in link on register page goes to /login', async ({ page }) => {
    await page.goto('/register');
    await page.getByRole('link', { name: /sign in/i }).click();
    await expect(page).toHaveURL('/login');
  });
});

// ---------------------------------------------------------------------------
// Live auth flows — require Supabase (skip in offline CI)
// ---------------------------------------------------------------------------

test.describe('Auth — live sign-in', () => {
  test.skip('invalid credentials show server error', async ({ page }) => {
    // TODO: enable once Supabase test project is seeded
    await page.goto('/login');
    await page.getByLabel('Email').fill('doesnotexist@example.com');
    await page.getByLabel('Password').fill('wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();
    // Server error rendered as <p class="text-destructive">
    await expect(page.locator('p.text-destructive')).toBeVisible({ timeout: 6000 });
  });

  test.skip('valid credentials redirect to /dashboard', async ({ page }) => {
    // TODO: add TEST_USER_EMAIL + TEST_USER_PASSWORD to CI secrets
    await page.goto('/login');
    await page.getByLabel('Email').fill(process.env.TEST_USER_EMAIL ?? '');
    await page.getByLabel('Password').fill(process.env.TEST_USER_PASSWORD ?? '');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL('/dashboard', { timeout: 10000 });
  });
});

test.describe('Auth — live register', () => {
  test.skip('successful registration shows email confirmation screen', async ({ page }) => {
    const email = `test+${Date.now()}@pokeplay.test`;
    await page.goto('/register');
    await page.getByLabel('Username').fill('TestTrainer');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('securepassword');
    await page.getByLabel('Confirm password').fill('securepassword');
    await page.getByRole('button', { name: /create account/i }).click();
    // Success state: "Check your email" heading appears
    await expect(page.getByText('Check your email')).toBeVisible({ timeout: 10000 });
  });
});
