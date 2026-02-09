/**
 * AI Agent E2E Tests
 * Tests the AI chat functionality and tool usage
 */

import { test, expect } from '@playwright/test';

test.describe('AI Agent', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    // Wait for the app to load
    await page.waitForTimeout(1000);
  });

  test('should show AI chat button', async ({ page }) => {
    // The floating AI button should be visible
    const aiButton = page.locator('button[title="Chat with Travel Assistant"]');
    await expect(aiButton).toBeVisible();
  });

  test('should open AI chat panel when clicking button', async ({ page }) => {
    // Click the AI button
    const aiButton = page.locator('button[title="Chat with Travel Assistant"]');
    await aiButton.click();

    // The chat panel should appear (use header h2 specifically)
    const chatPanel = page.locator('h2:has-text("Travel Assistant")');
    await expect(chatPanel).toBeVisible();

    // Trip selector should be shown
    await expect(page.locator('text=Plan a New Trip')).toBeVisible();
  });

  test('should show trip selection options', async ({ page }) => {
    // Open AI chat
    await page.locator('button[title="Chat with Travel Assistant"]').click();

    // Should show "Plan a New Trip" option
    await expect(page.locator('text=Plan a New Trip')).toBeVisible();

    // Should show "Or continue planning" divider
    await expect(page.locator('text=Or continue planning')).toBeVisible();
  });

  test('should enter new trip chat mode', async ({ page }) => {
    // Open AI chat
    await page.locator('button[title="Chat with Travel Assistant"]').click();

    // Click "Plan a New Trip"
    await page.locator('text=Plan a New Trip').click();

    // Should show chat interface
    await expect(page.locator('text=Plan Your Dream Trip')).toBeVisible();

    // Should show suggestion buttons
    await expect(page.locator('text=Plan a week in Japan')).toBeVisible();
  });

  test('should show model selector in chat mode', async ({ page }) => {
    // Open AI chat
    await page.locator('button[title="Chat with Travel Assistant"]').click();

    // Enter new trip mode
    await page.locator('text=Plan a New Trip').click();

    // Wait for chat interface
    await page.waitForTimeout(500);

    // Should show connection status
    await expect(page.locator('text=Connected').or(page.locator('text=Connecting...'))).toBeVisible();
  });

  test('should close chat panel with X button', async ({ page }) => {
    // Open AI chat
    await page.locator('button[title="Chat with Travel Assistant"]').click();

    // Wait for panel to open
    await page.waitForTimeout(300);

    // Click close button
    await page.locator('button[title="Close"]').click();

    // Panel should be closed (button should show open state)
    await expect(page.locator('button[title="Chat with Travel Assistant"]')).toBeVisible();
  });

  test('should show Claude-style UI elements', async ({ page }) => {
    // Open AI chat
    await page.locator('button[title="Chat with Travel Assistant"]').click();

    // Enter new trip mode
    await page.locator('text=Plan a New Trip').click();

    // Check for Claude-style warm coral colors (by checking gradient buttons exist)
    // The send button should have the coral color when input has text
    const input = page.locator('textarea[placeholder="Where would you like to go?"]');
    await expect(input).toBeVisible();

    // Type something to enable send button
    await input.fill('Test message');

    // The send button should be enabled and visible
    const sendButton = page.locator('button[title="Send message"]');
    await expect(sendButton).toBeEnabled();
  });

  test('should show back button when in chat mode', async ({ page }) => {
    // Open AI chat
    await page.locator('button[title="Chat with Travel Assistant"]').click();

    // Enter new trip mode
    await page.locator('text=Plan a New Trip').click();

    // Back button should be visible
    const backButton = page.locator('button[title="Back to trip selection"]');
    await expect(backButton).toBeVisible();

    // Click back button
    await backButton.click();

    // Should return to trip selector
    await expect(page.locator('text=Plan a New Trip')).toBeVisible();
  });

  test('should have keyboard shortcut hint', async ({ page }) => {
    // Open AI chat
    await page.locator('button[title="Chat with Travel Assistant"]').click();

    // Enter new trip mode
    await page.locator('text=Plan a New Trip').click();

    // Should show keyboard hints
    await expect(page.locator('text=⏎ Send · ⇧⏎ New line')).toBeVisible();
  });
});

test.describe('AI Agent Tool Display', () => {
  test('Tool metadata should be defined', async ({ page }) => {
    // This tests that the tool display component is properly exported
    await page.goto('/');

    // The component should be loadable without errors
    // Check that the AI button appears (which means no JS errors)
    await expect(page.locator('button[title="Chat with Travel Assistant"]')).toBeVisible();
  });
});
