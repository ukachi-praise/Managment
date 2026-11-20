import chromium from '@sparticuz/chromium';
import puppeteerCore from 'puppeteer-core';
import type { Browser } from 'puppeteer-core';

const isNetlifyServerless = () =>
  process.env.NETLIFY === 'true' ||
  Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME) ||
  Boolean(process.env.LAMBDA_TASK_ROOT);

/** One browser launcher for local development and Netlify's Linux functions. */
export async function launchPdfBrowser(): Promise<Browser> {
  if (isNetlifyServerless()) {
    try {
      const executablePath = await chromium.executablePath();
      return await puppeteerCore.launch({
        args: puppeteerCore.defaultArgs({ args: chromium.args, headless: 'shell' }),
        defaultViewport: { width: 800, height: 600, deviceScaleFactor: 1 },
        executablePath,
        headless: 'shell',
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`Unable to start the bundled Netlify Chromium executable: ${detail}`);
    }
  }

  // Keep the existing Puppeteer-managed browser for localhost. This package
  // remains a development dependency and is never used as Netlify's browser.
  try {
    const localPuppeteer = await import('puppeteer');
    return await localPuppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
    }) as unknown as Browser;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to start the local Puppeteer browser. Reinstall the development browser or set PUPPETEER_EXECUTABLE_PATH. ${detail}`);
  }
}
