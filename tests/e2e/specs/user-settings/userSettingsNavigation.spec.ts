import { test, expect } from '../../fixtures';
import { authenticate, logout } from '../../helpers/auth/index';
import { isHashRoute, getHashRoute } from '../../helpers/urlHelpers';
import { PROTECTED_ROUTES, TIMEOUTS } from '../../helpers/constants';
import { getAuthSessionStorage } from '../../helpers/sessionStorageHelpers';

/**
 * Tests for user settings navigation
 * 
 * These tests verify that users can access the user settings page
 * by clicking on the user container in the left sidebar menu.
 */
test.describe('User Settings Navigation', () => {
  // Configure tests to run serially to avoid race conditions with authentication
  test.describe.configure({ mode: 'serial' });
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const app = page.locator('v-app, [data-app], .v-application');
    await app.first().waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
  });

  test('should navigate to user settings when clicking user container in sidebar', async ({ page }) => {
    // Find the user container in the drawer
    // The user container has class "user-container" and contains:
    // - An avatar div with the user's initial
    // - A user-info div with the user's name and email (when drawer is expanded)
    const userContainer = page.locator('.user-container').first();
    
    // Wait for the user container to be visible
    await userContainer.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    
    // Verify the user container is visible before clicking
    await expect(userContainer).toBeVisible();

    // Click on the user container
    await userContainer.click();

    // Wait for navigation to user-settings route
    // In hash mode, the route will be #/user-settings
    await page.waitForURL(
      (url) => {
        const hash = url.hash;
        return hash.includes('/user-settings');
      },
      { timeout: TIMEOUTS.NAVIGATION }
    );

    // Verify we're on the user-settings route
    const hash = getHashRoute(page);
    expect(hash).toContain('/user-settings');
    expect(isHashRoute(page, PROTECTED_ROUTES)).toBe(true);

    // Verify the user settings page title is displayed
    // The title can be in different languages: "Configuración de usuario" (ES), "User configuration" (EN), "Configuration utilisateur" (FR)
    // Use getByRole('heading') to specifically target the page title (h4) and avoid matching the tab button
    const pageTitle = page.getByRole('heading', { name: /Configuración de usuario|User configuration|Configuration utilisateur/i });
    await pageTitle.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    await expect(pageTitle).toBeVisible();

    // Verify the page description is displayed
    // The description mentions changing user preferences
    const pageDescription = page.getByText(/preferencias|preferences|préférences/i);
    await expect(pageDescription.first()).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
  });

  test('should display user settings tabs after navigation', async ({ page }) => {
    // Navigate to user settings by clicking the user container
    const userContainer = page.locator('.user-container').first();
    await userContainer.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    await userContainer.click();

    // Wait for navigation
    await page.waitForURL(
      (url) => url.hash.includes('/user-settings'),
      { timeout: TIMEOUTS.NAVIGATION }
    );

    // Verify the user settings tab is visible
    // The tab text can be: "Configuración de usuario" (ES), "User settings" (EN), "Paramètres utilisateur" (FR)
    // Use getByRole('tab') to specifically target the tab button
    const userSettingsTab = page.getByRole('tab', { name: /Configuración de usuario|User settings|Paramètres utilisateur/i });
    await userSettingsTab.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    await expect(userSettingsTab).toBeVisible();
  });

  test('should display user-settings tab content (theme and language)', async ({ page }) => {
    // Navigate to user settings
    const userContainer = page.locator('.user-container').first();
    await userContainer.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    await userContainer.click();

    // Wait for navigation
    await page.waitForURL(
      (url) => url.hash.includes('/user-settings'),
      { timeout: TIMEOUTS.NAVIGATION }
    );

    // Verify the user-settings tab is active by default
    const userSettingsTab = page.getByRole('tab', { name: /Configuración de usuario|User settings|Paramètres utilisateur/i });
    await userSettingsTab.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    await expect(userSettingsTab).toBeVisible();

    // Verify Theme section is displayed
    // Translations: "Tema" (ES), "Theme" (EN), "Thème" (FR)
    const themeTitle = page.getByText(/^Tema$|^Theme$|^Thème$/i);
    await themeTitle.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    await expect(themeTitle).toBeVisible();

    // Verify theme description is displayed
    // Translations: "Selecciona el tema principal de la aplicación" (ES), "Select the main theme of the application" (EN), "Sélectionnez le thème principal de l'application" (FR)
    const themeDescription = page.getByText(/Selecciona el tema principal|Select the main theme|Sélectionnez le thème principal/i);
    await expect(themeDescription).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });

    // Verify Light theme option is displayed
    // Translations: "Claro" (ES), "Light" (EN), "Clair" (FR)
    const lightThemeOption = page.getByRole('radio', { name: /Claro|Light|Clair/i });
    await expect(lightThemeOption).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });

    // Verify Language section is displayed
    // Translations: "Idioma" (ES), "Language" (EN), "Langue" (FR)
    const languageTitle = page.getByText(/^Idioma$|^Language$|^Langue$/i);
    await expect(languageTitle).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });

    // Verify language description is displayed
    // Translations: "Selecciona el idioma principal de la aplicación" (ES), "Select the main language of the application" (EN), "Sélectionnez la langue principale de l'application" (FR)
    const languageDescription = page.getByText(/Selecciona el idioma principal|Select the main language|Sélectionnez la langue principale/i);
    await expect(languageDescription).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });

    // Verify language selector (v-select) is displayed
    // v-select in Vuetify may not expose as combobox with the label name
    // We verify the description is visible and then check for the selected language value
    const languageDescriptionElement = page.getByText(/Selecciona el idioma principal|Select the main language|Sélectionnez la langue principale/i);
    await expect(languageDescriptionElement).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
    
    // Verify the v-select is present by checking for the selected language value
    // The v-select should display the current language (only three languages available: Inglés, Español, Francés)
    // This confirms the selector is rendered and has a value
    const selectedLanguage = page.getByText(/Inglés|English|Anglais|Español|Spanish|Espagnol|Francés|French|Français/i);
    await expect(selectedLanguage.first()).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
  });

  test('should display user-profile tab content (password change)', async ({ page }) => {
    // Navigate to user settings
    const userContainer = page.locator('.user-container').first();
    await userContainer.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    await userContainer.click();

    // Wait for navigation
    await page.waitForURL(
      (url) => url.hash.includes('/user-settings'),
      { timeout: TIMEOUTS.NAVIGATION }
    );

    // Find and click the user-profile tab
    // Translations: "Perfil de usuario" (ES), "User profile" (EN), "Profil utilisateur" (FR)
    const userProfileTab = page.getByRole('tab', { name: /Perfil de usuario|User profile|Profil utilisateur/i });
    await userProfileTab.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    await expect(userProfileTab).toBeVisible();
    await userProfileTab.click();

    // Wait a bit for the tab content to load
    await page.waitForTimeout(500);

    // Verify User Security section is displayed
    // Translations: "Seguridad del usuario" (ES), "User security" (EN), "Sécurité de l'utilisateur" (FR)
    const userSecurityTitle = page.getByText(/Seguridad del usuario|User security|Sécurité de l'utilisateur/i);
    await userSecurityTitle.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    await expect(userSecurityTitle).toBeVisible();

    // Verify change password description is displayed
    // Translations: "Cambiar contraseña" (ES), "Change your password" (EN), "Changer le mot de passe" (FR)
    const changePasswordDescription = page.getByText(/Cambiar contraseña|Change your password|Changer le mot de passe/i);
    await expect(changePasswordDescription).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });

    // Verify New Password field is displayed
    // Translations: "Nueva contraseña" (ES), "New password" (EN), "Nouveau mot de passe" (FR)
    // MInputField may not expose labels correctly, so we find password inputs near the title text
    // First, find all password inputs in the form
    const passwordInputs = page.locator('input[type="password"]');
    await expect(passwordInputs.first()).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
    
    // Verify there are at least 2 password fields (new password and confirm password)
    const passwordInputsCount = await passwordInputs.count();
    expect(passwordInputsCount).toBeGreaterThanOrEqual(2);
    
    // Verify the first password field (new password) is visible
    const newPasswordField = passwordInputs.first();
    await expect(newPasswordField).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
    await expect(newPasswordField).toHaveAttribute('type', 'password');

    // Verify the second password field (confirm password) is visible
    const confirmPasswordField = passwordInputs.nth(1);
    await expect(confirmPasswordField).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
    await expect(confirmPasswordField).toHaveAttribute('type', 'password');

    // Verify Submit button is displayed
    // Translations: "Enviar" (ES), "Submit" (EN), "Soumettre" (FR)
    const submitButton = page.getByRole('button', { name: /Enviar|Submit|Soumettre/i });
    await expect(submitButton).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
    // The button should be disabled initially (when password fields are empty)
    await expect(submitButton).toBeDisabled();
  });

  test('should be able to switch between both tabs', async ({ page }) => {
    // Navigate to user settings
    const userContainer = page.locator('.user-container').first();
    await userContainer.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    await userContainer.click();

    // Wait for navigation
    await page.waitForURL(
      (url) => url.hash.includes('/user-settings'),
      { timeout: TIMEOUTS.NAVIGATION }
    );

    // Verify both tabs are visible
    const userSettingsTab = page.getByRole('tab', { name: /Configuración de usuario|User settings|Paramètres utilisateur/i });
    const userProfileTab = page.getByRole('tab', { name: /Perfil de usuario|User profile|Profil utilisateur/i });
    
    await userSettingsTab.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    await userProfileTab.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    
    await expect(userSettingsTab).toBeVisible();
    await expect(userProfileTab).toBeVisible();

    // Verify user-settings tab is active by default (shows theme section)
    const themeTitle = page.getByText(/^Tema$|^Theme$|^Thème$/i);
    await expect(themeTitle).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });

    // Click on user-profile tab
    await userProfileTab.click();
    await page.waitForTimeout(500);

    // Verify user-profile content is displayed (user security section)
    const userSecurityTitle = page.getByText(/Seguridad del usuario|User security|Sécurité de l'utilisateur/i);
    await userSecurityTitle.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    await expect(userSecurityTitle).toBeVisible();

    // Verify theme section is no longer visible
    await expect(themeTitle).not.toBeVisible();

    // Click back on user-settings tab
    await userSettingsTab.click();
    await page.waitForTimeout(500);

    // Verify user-settings content is displayed again
    await expect(themeTitle).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
    
    // Verify user-profile content is no longer visible
    await expect(userSecurityTitle).not.toBeVisible();
  });

  test('should change language when selecting a different language in the language selector', async ({ page }) => {
    // Navigate to user settings
    const userContainer = page.locator('.user-container').first();
    await userContainer.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    await userContainer.click();

    // Wait for navigation
    await page.waitForURL(
      (url) => url.hash.includes('/user-settings'),
      { timeout: TIMEOUTS.NAVIGATION }
    );

    // Wait for the language section to be visible
    const languageDescription = page.getByText(/Selecciona el idioma principal|Select the main language|Sélectionnez la langue principale/i);
    await expect(languageDescription).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });

    // Get the current language by checking which text is visible
    // We'll determine the current language and then change to a different one
    // Only three languages are available: Inglés, Español, Francés
    const currentLanguageText = page.getByText(/Inglés|English|Anglais|Español|Spanish|Espagnol|Francés|French|Français/i);
    await expect(currentLanguageText.first()).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
    
    // Get the current language value from the visible text
    const currentText = await currentLanguageText.first().textContent();
    
    // Determine current language code and target language
    let currentLangCode: string;
    let targetLangCode: string;
    let targetLanguageTexts: string[]; // Array of possible texts in different languages
    let expectedThemeText: string;
    let expectedLanguageDescription: string;
    
    // Determine target language based on current language
    if (currentText?.includes('Español') || currentText?.includes('Spanish') || currentText?.includes('Espagnol')) {
      // Currently Spanish, change to English
      currentLangCode = 'es';
      targetLangCode = 'en';
      // In Spanish UI: "Inglés", in English UI: "English", in French UI: "Anglais"
      targetLanguageTexts = ['Inglés', 'English', 'Anglais'];
      expectedThemeText = 'Theme';
      expectedLanguageDescription = 'Select the main language of the application';
    } else if (currentText?.includes('English') || currentText?.includes('Inglés') || currentText?.includes('Anglais')) {
      // Currently English, change to French
      currentLangCode = 'en';
      targetLangCode = 'fr';
      // In Spanish UI: "Francés", in English UI: "French", in French UI: "Français"
      targetLanguageTexts = ['Francés', 'French', 'Français'];
      expectedThemeText = 'Thème';
      expectedLanguageDescription = "Sélectionnez la langue principale de l'application";
    } else {
      // Currently French, change to Spanish
      currentLangCode = 'fr';
      targetLangCode = 'es';
      // In Spanish UI: "Español", in English UI: "Spanish", in French UI: "Espagnol"
      targetLanguageTexts = ['Español', 'Spanish', 'Espagnol'];
      expectedThemeText = 'Tema';
      expectedLanguageDescription = 'Selecciona el idioma principal de la aplicación';
    }

    // Find the v-select component - click on it to open the dropdown
    // v-select in Vuetify renders as a clickable field with class v-field
    // Find it by locating the field that contains the current language text
    const languageField = page.locator('.v-field').filter({ hasText: currentText || '' }).first();
    
    // If that doesn't work, find any v-field near the language description
    let fieldToClick = languageField;
    const fieldCount = await languageField.count();
    if (fieldCount === 0) {
      // Find the language description and locate the v-field nearby
      const languageDescriptionElement = page.getByText(/Selecciona el idioma principal|Select the main language|Sélectionnez la langue principale/i);
      await expect(languageDescriptionElement).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
      
      // Find the parent container and then the v-field
      const parentContainer = languageDescriptionElement.locator('..').locator('..');
      fieldToClick = parentContainer.locator('.v-field').first();
    }
    
    await expect(fieldToClick).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
    
    // Click on the language selector to open the dropdown
    await fieldToClick.click();
    
    // Wait for the dropdown menu to appear and be visible
    // Vuetify v-select opens a menu - wait for it to be visible
    await page.waitForTimeout(500);
    
    // Wait for menu/overlay to be visible (try multiple selectors)
    try {
      await page.waitForSelector('.v-menu, .v-overlay, [role="listbox"], .v-list', { state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
    } catch (e) {
      // Menu might already be visible, continue
    }
    await page.waitForTimeout(300);
    
    // Find and click on the target language option in the dropdown
    // Try multiple strategies to find the clickable option using all possible text variations
    let targetLanguageOption;
    
    // Build a regex pattern that matches any of the target language texts
    const targetLanguagePattern = new RegExp(targetLanguageTexts.join('|'), 'i');
    
    // Strategy 1: Find by role="option" with any of the target language texts
    const optionByRole = page.getByRole('option', { name: targetLanguagePattern });
    if (await optionByRole.count() > 0) {
      targetLanguageOption = optionByRole.first();
    } else {
      // Strategy 2: Find by v-list-item with any of the target language texts
      const listItem = page.locator('.v-list-item').filter({ hasText: targetLanguagePattern });
      if (await listItem.count() > 0) {
        targetLanguageOption = listItem.first();
      } else {
        // Strategy 3: Find text in menu/overlay content with any of the target language texts
        const menuContent = page.locator('.v-overlay__content, .v-menu__content, .v-list').getByText(targetLanguagePattern);
        if (await menuContent.count() > 0) {
          targetLanguageOption = menuContent.first();
        } else {
          // Strategy 4: Find any visible text matching any of the target language texts that's not in the field
          // Try each target language text individually
          for (const targetText of targetLanguageTexts) {
            const allTexts = page.getByText(new RegExp(targetText, 'i'));
            const count = await allTexts.count();
            
            // Find the one that's visible and clickable (not the one in the v-field)
            for (let i = 0; i < count; i++) {
              const textEl = allTexts.nth(i);
              if (await textEl.isVisible()) {
                // Check if it's not inside a v-field (the current selection)
                const isInField = await textEl.locator('xpath=ancestor::*[contains(@class, "v-field")]').count() > 0;
                if (!isInField) {
                  // Try to find a clickable parent (v-list-item or option)
                  const clickableParent = textEl.locator('xpath=ancestor::*[contains(@class, "v-list-item") or @role="option"]').first();
                  if (await clickableParent.count() > 0) {
                    targetLanguageOption = clickableParent;
                  } else {
                    // Try clicking the text element itself or its closest clickable ancestor
                    const closestClickable = textEl.locator('xpath=ancestor-or-self::*[@role="button" or @role="option" or contains(@class, "v-list-item")]').first();
                    if (await closestClickable.count() > 0) {
                      targetLanguageOption = closestClickable;
                    } else {
                      targetLanguageOption = textEl;
                    }
                  }
                  break;
                }
              }
            }
            if (targetLanguageOption) break;
          }
        }
      }
    }
    
    // Verify we found the option and click it
    if (!targetLanguageOption) {
      throw new Error(`Could not find target language option for: ${targetLanguageTexts.join(', ')}`);
    }
    await expect(targetLanguageOption).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
    await targetLanguageOption.click();
    
    // Wait for the language change to take effect
    await page.waitForTimeout(1000);
    
    // Verify the language selector now shows the new language
    // Use the pattern that matches any of the target language texts (reuse the pattern from above)
    const newLanguageText = page.getByText(targetLanguagePattern);
    await expect(newLanguageText.first()).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
    
    // Verify that the UI text has changed by checking the theme title
    // The theme title should now be in the new language
    const themeTitle = page.getByText(new RegExp(`^${expectedThemeText}$`, 'i'));
    await expect(themeTitle).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
    
    // Verify other texts have changed too (e.g., language description)
    const languageDescriptionNew = page.getByText(new RegExp(expectedLanguageDescription, 'i'));
    await expect(languageDescriptionNew).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
  });

  test('should change password successfully and restore original password', async ({ page }) => {
    // Save the original password from environment variable
    const originalPassword = process.env.PLAYWRIGHT_TEST_PASSWORD;
    if (!originalPassword) {
      throw new Error('PLAYWRIGHT_TEST_PASSWORD environment variable is not set');
    }

    // Get temporary password from environment variable
    // Must meet password rules: min 5 chars, uppercase, lowercase, number, special char, no spaces
    const temporaryPassword = process.env.PLAYWRIGHT_TEST_TEMP_PASSWORD;
    if (!temporaryPassword) {
      throw new Error('PLAYWRIGHT_TEST_TEMP_PASSWORD environment variable is not set');
    }
    
    // Get backend URL from environment
    const backendUrl = process.env.PLAYWRIGHT_BACKEND_URL || process.env.VITE_APP_BACKEND_URL;
    if (!backendUrl) {
      throw new Error('Backend URL is not configured. Set PLAYWRIGHT_BACKEND_URL or VITE_APP_BACKEND_URL');
    }

    let userId: string | null = null;
    let authTokenForRestore: string | null = null;

    try {
      // Step 1: Navigate to user settings
      const userContainer = page.locator('.user-container').first();
      await userContainer.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
      await userContainer.click();

      // Wait for navigation
      await page.waitForURL(
        (url) => url.hash.includes('/user-settings'),
        { timeout: TIMEOUTS.NAVIGATION }
      );

      // Step 2: Get user ID (we'll get the token after password change)
      const authData = await getAuthSessionStorage(page);
      userId = authData.userId;

      if (!userId) {
        throw new Error('User ID not found in sessionStorage');
      }

      // Step 3: Navigate to user-profile tab
      const userProfileTab = page.getByRole('tab', { name: /Perfil de usuario|User profile|Profil utilisateur/i });
      await userProfileTab.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
      await expect(userProfileTab).toBeVisible();
      await userProfileTab.click();

      // Wait for tab content to load
      await page.waitForTimeout(500);

      // Verify User Security section is displayed
      const userSecurityTitle = page.getByText(/Seguridad del usuario|User security|Sécurité de l'utilisateur/i);
      await userSecurityTitle.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
      await expect(userSecurityTitle).toBeVisible();

      // Step 4: Fill password fields
      const passwordInputs = page.locator('input[type="password"]');
      await expect(passwordInputs.first()).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
      
      const newPasswordField = passwordInputs.first();
      const confirmPasswordField = passwordInputs.nth(1);

      // Fill new password
      await newPasswordField.fill(temporaryPassword);
      await page.waitForTimeout(TIMEOUTS.INPUT_FILL_DELAY);

      // Fill confirm password
      await confirmPasswordField.fill(temporaryPassword);
      await page.waitForTimeout(TIMEOUTS.INPUT_FILL_DELAY);

      // Step 5: Verify submit button is enabled
      const submitButton = page.getByRole('button', { name: /Enviar|Submit|Soumettre/i });
      await expect(submitButton).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
      await expect(submitButton).toBeEnabled({ timeout: TIMEOUTS.BUTTON_ENABLE });

      // Step 6: Submit the form
      await submitButton.click();

      // Step 7: Wait for and verify success message
      // Success messages: "Password updated successfully" (EN), "Contraseña actualizada correctamente" (ES), "Mot de passe mis à jour avec succès" (FR)
      const successSnackbar = page.locator('.v-snackbar').filter({ 
        hasText: /Password updated successfully|Contraseña actualizada correctamente|Mot de passe mis à jour avec succès/i 
      });
      await expect(successSnackbar).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
      
      // Verify the snackbar text content
      const snackbarText = await successSnackbar.textContent();
      expect(snackbarText).toMatch(/Password updated successfully|Contraseña actualizada correctamente|Mot de passe mis à jour avec succès/i);

      // Wait a bit for the snackbar to be fully displayed
      await page.waitForTimeout(1000);

      // Step 8: Logout
      await logout(page, true);

      // Step 9: Verify login with new password works
      await authenticate(page, undefined, temporaryPassword, {
        waitForNavigation: true,
        verifyAuth: true
      });

      // Verify we're authenticated by checking we're on a protected route
      const hash = getHashRoute(page);
      expect(isHashRoute(page, PROTECTED_ROUTES)).toBe(true);

      // Step 10: Get token after login with new password (we'll use this to restore)
      const authDataAfterLogin = await getAuthSessionStorage(page);
      authTokenForRestore = authDataAfterLogin.token;

      if (!authTokenForRestore) {
        throw new Error('Authentication token not found after login with new password');
      }

    } finally {
      // Step 11: Restore original password using UI (more reliable than direct API)
      // This must always execute, even if the test fails
      try {
        // Ensure we're logged out first
        try {
          await logout(page, true);
        } catch {
          // Ignore if already logged out
        }

        // Try to login with temporary password to restore
        try {
          await authenticate(page, undefined, temporaryPassword, {
            waitForNavigation: true,
            verifyAuth: true
          });

          // Navigate to user settings
          const userContainer = page.locator('.user-container').first();
          await userContainer.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
          await userContainer.click();

          // Wait for navigation
          await page.waitForURL(
            (url) => url.hash.includes('/user-settings'),
            { timeout: TIMEOUTS.NAVIGATION }
          );

          // Navigate to user-profile tab
          const userProfileTab = page.getByRole('tab', { name: /Perfil de usuario|User profile|Profil utilisateur/i });
          await userProfileTab.waitFor({ state: 'visible', timeout: TIMEOUTS.FORM_LOAD });
          await userProfileTab.click();
          await page.waitForTimeout(500);

          // Fill password fields with original password
          const passwordInputs = page.locator('input[type="password"]');
          await expect(passwordInputs.first()).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
          
          const newPasswordField = passwordInputs.first();
          const confirmPasswordField = passwordInputs.nth(1);

          // Fill with original password
          await newPasswordField.fill(originalPassword);
          await page.waitForTimeout(TIMEOUTS.INPUT_FILL_DELAY);
          await confirmPasswordField.fill(originalPassword);
          await page.waitForTimeout(TIMEOUTS.INPUT_FILL_DELAY);

          // Submit the form
          const submitButton = page.getByRole('button', { name: /Enviar|Submit|Soumettre/i });
          await expect(submitButton).toBeEnabled({ timeout: TIMEOUTS.BUTTON_ENABLE });
          await submitButton.click();

          // Wait for success message
          const successSnackbar = page.locator('.v-snackbar').filter({ 
            hasText: /Password updated successfully|Contraseña actualizada correctamente|Mot de passe mis à jour avec succès/i 
          });
          await expect(successSnackbar).toBeVisible({ timeout: TIMEOUTS.FORM_LOAD });
          
          console.log('✅ Original password restored successfully via UI');

        } catch (tempPasswordError) {
          // If temporary password doesn't work, try original (maybe it wasn't changed)
          console.log('⚠️  Login with temporary password failed, trying original password...');
          try {
            await authenticate(page, undefined, originalPassword, {
              waitForNavigation: true,
              verifyAuth: true
            });
            console.log('✅ Password is already the original password. No restoration needed.');
          } catch (originalPasswordError) {
            console.error('❌ Both temporary and original passwords failed!');
            throw new Error(
              'Cannot restore password: both temporary and original passwords failed. ' +
              'You may need to reset the password manually through the admin interface.'
            );
          }
        }

        // Step 12: Verify login with original password works
        try {
          // Logout first if still authenticated
          try {
            await logout(page, true);
          } catch {
            // Ignore if already logged out
          }

          // Try to login with original password to verify restoration
          await authenticate(page, undefined, originalPassword, {
            waitForNavigation: true,
            verifyAuth: true
          });

          // Verify we're authenticated
          const hash = getHashRoute(page);
          expect(isHashRoute(page, PROTECTED_ROUTES)).toBe(true);
          console.log('✅ Verified: Login with original password works!');
        } catch (error) {
          console.error('Failed to verify login with restored password:', error);
          // This is a critical failure - the password might not have been restored
          throw new Error(`Password restoration verification failed. Original password may not have been restored correctly. Error: ${error}`);
        }
      } catch (error) {
        console.error('Error in password restoration flow:', error);
        // Re-throw to ensure test fails if restoration fails
        throw new Error(`Password restoration failed. Original password may not have been restored. Error: ${error}`);
      }
    }
  });
});
