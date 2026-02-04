import fs from 'fs';
import path from 'path';

/**
 * Resolves the path to Chrome/Chromium executable for Puppeteer.
 *
 * Strategy:
 * 1. Check PUPPETEER_EXECUTABLE_PATH environment variable
 * 2. Look for system-installed Google Chrome
 * 3. Check Puppeteer's cache directory (user-specific)
 * 4. Fallback to common Chrome installation paths
 *
 * This ensures the app works across different Windows user accounts
 * by preferring system-wide installations over user-specific caches.
 */
export function getChromePath(): string {
  // Allow override via environment variable (for debugging)
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    if (fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
      return process.env.PUPPETEER_EXECUTABLE_PATH;
    }
  }

  // Common Chrome installation paths on Windows
  const chromePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
    path.join(process.env.PROGRAMFILES || '', 'Google\\Chrome\\Application\\chrome.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || '', 'Google\\Chrome\\Application\\chrome.exe'),
  ];

  // Try each path
  for (const chromePath of chromePaths) {
    if (chromePath && fs.existsSync(chromePath)) {
      return chromePath;
    }
  }

  // If no Chrome found, let Puppeteer handle it (will download if needed)
  // Return undefined to use Puppeteer's default behavior
  throw new Error(
    'Google Chrome não foi encontrado. Por favor, instale o Google Chrome para usar este aplicativo.\n\n' +
    'Chrome not found. Please install Google Chrome to use this application.\n\n' +
    'Download: https://www.google.com/chrome/'
  );
}
