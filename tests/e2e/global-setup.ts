import { FullConfig } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * Checks if the application is configured to use hash mode routing
 * by examining the src/app/config.ts file
 */
function detectHashMode(): boolean {
  try {
    const configPath = path.join(process.cwd(), 'src', 'app', 'config.ts');
    const configContent = fs.readFileSync(configPath, 'utf8');
    return configContent.includes('useHashMode: true');
  } catch (error) {
    console.warn('Could not detect hash mode from config file:', error);
    return false;
  }
}

/**
 * Global setup function that runs before all tests
 * This can be used for global setup like setting up test data
 */
async function globalSetup(config: FullConfig) {
  // This function runs once before all tests
  
  // Detect if hash mode is enabled
  const isHashMode = detectHashMode();
  console.log(`Detected useHashMode: ${isHashMode ? 'true' : 'false'}`);
  
  // Store the hash mode setting in the environment
  process.env.USE_HASH_MODE = isHashMode ? 'true' : 'false';
  
  console.log('Starting Playwright E2E tests...');
}

export default globalSetup; 