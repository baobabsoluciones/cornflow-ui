import { test as setup } from '@playwright/test';
import { authenticate } from './helpers/auth/index';
import { stripSkipKeyFromSavedStorageState } from './helpers/authInjectSkip';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const authFile = path.join(__dirname, '.auth', 'user.json');

/**
 * Global authentication setup
 *
 * This setup runs once before all tests. It:
 * 1. Performs a real login via the UI
 * 2. Captures the browser storage state (cookies + localStorage)
 * 3. Captures sessionStorage values (auth token, userId, etc.)
 * 4. Saves everything to .auth/user.json
 *
 * Subsequent tests reuse this state via the custom fixture,
 * avoiding redundant logins and significantly speeding up the suite.
 */
setup('authenticate', async ({ page }) => {
  // Older runs could persist the E2E skip flag in user.json; strip so tests don't skip inject.
  if (fs.existsSync(authFile)) {
    try {
      const previous = JSON.parse(fs.readFileSync(authFile, 'utf-8'));
      if (stripSkipKeyFromSavedStorageState(previous)) {
        fs.writeFileSync(authFile, JSON.stringify(previous, null, 2));
      }
    } catch {
      /* ignore */
    }
  }

  // Perform login via the UI (uses PLAYWRIGHT_TEST_USER / PLAYWRIGHT_TEST_PASSWORD)
  await authenticate(page);

  // Capture sessionStorage (Playwright's storageState does NOT include sessionStorage)
  const sessionData = await page.evaluate(() => {
    const data: Record<string, string> = {};
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)!;
      data[key] = sessionStorage.getItem(key)!;
    }
    return data;
  });

  // Capture cookies + localStorage via Playwright's storageState API
  const storageState = await page.context().storageState();

  // Merge sessionStorage into the state file
  const fullState = {
    ...storageState,
    sessionStorage: sessionData,
  };

  stripSkipKeyFromSavedStorageState(fullState);

  // Ensure the .auth directory exists
  const dir = path.dirname(authFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Write the combined state to disk
  fs.writeFileSync(authFile, JSON.stringify(fullState, null, 2));
});
