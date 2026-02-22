/**
 * E2E tests — ROM upload and game launch flows.
 *
 * Architecture rules verified here:
 * - ROMs NEVER touch the server (CLAUDE.md rule 1)
 * - ROM validation: .gb, .gbc, .gba, .rom only; max 64 MB
 * - ROM is identified by SHA-1 hash, not stored or transmitted
 * - IndexedDB stores ROM data client-side
 *
 * NOTE: These tests require a running dev server and an authenticated session.
 */

import { test, expect, type Page } from '@playwright/test';
import path from 'path';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// Paths to test ROM zips (gitignored, present in dev environment)
const ROM_ZIP_GB = path.join(
  process.cwd(),
  'Pokemon - Red Version (USA, Europe) (SGB Enhanced).zip',
);
const ROM_ZIP_GBA = path.join(process.cwd(), 'Pokemon - Emerald Version (USA, Europe).zip');

// Minimal fixture files for upload validation tests
const FIXTURES_DIR = path.join(process.cwd(), 'tests/fixtures');

// ---------------------------------------------------------------------------
// Upload page — basic navigation
// ---------------------------------------------------------------------------

test.describe('ROM upload — navigation', () => {
  test('game library page is accessible', async ({ page }) => {
    await page.goto('/');
    // TODO: update once dashboard/library page is implemented by frontend teammate
    await expect(page).toHaveTitle(/PokéPlay|Pokémon/i);
  });

  test.skip('authenticated user can navigate to ROM upload', async ({ page }) => {
    // TODO: implement once dashboard and upload UI are created
    await page.goto('/dashboard');
    await page.getByRole('button', { name: /upload|add game/i }).click();
    await expect(page.getByText(/upload rom|select file/i)).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// ROM file validation (client-side, no server contact)
// ---------------------------------------------------------------------------

test.describe('ROM upload — client-side validation', () => {
  test.skip('accepts .gb file extension', async ({ page }) => {
    // TODO: implement once ROM upload component is created
    await page.goto('/dashboard');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test.gb',
      mimeType: 'application/octet-stream',
      buffer: Buffer.alloc(1024),
    });
    await expect(page.getByText(/invalid|error/i)).not.toBeVisible();
  });

  test.skip('accepts .gbc file extension', async ({ page }) => {
    // TODO: implement once ROM upload component is created
    await page.goto('/dashboard');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test.gbc',
      mimeType: 'application/octet-stream',
      buffer: Buffer.alloc(1024),
    });
    await expect(page.getByText(/invalid|error/i)).not.toBeVisible();
  });

  test.skip('accepts .gba file extension', async ({ page }) => {
    // TODO: implement once ROM upload component is created
    await page.goto('/dashboard');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test.gba',
      mimeType: 'application/octet-stream',
      buffer: Buffer.alloc(1024),
    });
    await expect(page.getByText(/invalid|error/i)).not.toBeVisible();
  });

  test.skip('rejects .exe file extension', async ({ page }) => {
    // TODO: implement once ROM upload component is created
    await page.goto('/dashboard');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test.exe',
      mimeType: 'application/octet-stream',
      buffer: Buffer.alloc(1024),
    });
    await expect(page.getByText(/invalid file type/i)).toBeVisible();
  });

  test.skip('rejects files larger than 64 MB', async ({ page }) => {
    // TODO: implement once ROM upload component is created
    const OVER_LIMIT = 65 * 1024 * 1024; // 65 MB
    await page.goto('/dashboard');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'huge.gba',
      mimeType: 'application/octet-stream',
      buffer: Buffer.alloc(OVER_LIMIT),
    });
    await expect(page.getByText(/too large|size|64 mb/i)).toBeVisible();
  });

  test.skip('rejects empty files', async ({ page }) => {
    // TODO: implement once ROM upload component is created
    await page.goto('/dashboard');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'empty.gb',
      mimeType: 'application/octet-stream',
      buffer: Buffer.alloc(0),
    });
    await expect(page.getByText(/empty|file/i)).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// ROM security — verify ROM data does not reach the server
// ---------------------------------------------------------------------------

test.describe('ROM upload — server isolation (security)', () => {
  test.skip('no network request is made containing ROM binary data', async ({ page }) => {
    // TODO: implement once ROM upload component is created.
    // This is a critical security test: ROMs must NEVER touch the server.
    //
    // Strategy: intercept all network requests and verify no request body
    // contains the ROM magic bytes.
    const romMagicBytes = Buffer.from([0x4e, 0x49, 0x4e, 0x54, 0x45, 0x4e, 0x44, 0x4f]);

    const suspiciousRequests: string[] = [];

    page.on('request', (req) => {
      const postData = req.postDataBuffer();
      if (postData && postData.includes(romMagicBytes)) {
        suspiciousRequests.push(req.url());
      }
    });

    await page.goto('/dashboard');
    // Simulate ROM upload...
    // await fileInput.setInputFiles(...)

    expect(suspiciousRequests).toHaveLength(0);
  });

  test.skip('ROM hash (SHA-1) is computed and displayed without transmitting ROM', async ({
    page,
  }) => {
    // TODO: implement once ROM upload and hashing are integrated in UI
    // 1. Upload a known ROM file
    // 2. Verify the displayed hash matches the expected SHA-1
    // 3. Verify no upload request contains raw ROM data
    await page.goto('/dashboard');
    // Expected SHA-1 for Pokemon Red (USA, Europe) (SGB Enhanced):
    // This will be filled in after computing from the fixture file.
    const EXPECTED_HASH_PREFIX = 'a1'; // placeholder
    await expect(page.getByText(new RegExp(EXPECTED_HASH_PREFIX))).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Game launch
// ---------------------------------------------------------------------------

test.describe('ROM upload — game launch', () => {
  test.skip('uploaded ROM launches in emulator', async ({ page }) => {
    // TODO: implement once EmulatorWrapper component is created by emulator teammate
    // 1. Upload ROM file
    // 2. Wait for emulator to initialize
    // 3. Verify emulator canvas/iframe is visible
    await page.goto('/play/pokemon-red');
    await expect(page.locator('#emulator-container, #emulator-canvas')).toBeVisible({
      timeout: 15000,
    });
  });

  test.skip('emulator shows loading state while initializing', async ({ page }) => {
    // TODO: implement once EmulatorWrapper component is created
    await page.goto('/play/pokemon-red');
    // Should briefly show loading indicator
    await expect(page.getByText(/loading|initializing/i)).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Game library
// ---------------------------------------------------------------------------

test.describe('ROM upload — game library', () => {
  test.skip('uploaded games appear in game library', async ({ page }) => {
    // TODO: implement once dashboard UI is created by frontend teammate
    await page.goto('/dashboard');
    await expect(page.getByRole('list', { name: /games|library/i })).toBeVisible();
  });

  test.skip('game can be deleted from library', async ({ page }) => {
    // TODO: implement once game library UI supports deletion
    await page.goto('/dashboard');
    await page.getByRole('button', { name: /delete|remove/i }).first().click();
    await page.getByRole('button', { name: /confirm/i }).click();
    // Game should no longer be in list
  });
});
