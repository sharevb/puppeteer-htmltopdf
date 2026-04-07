import fs from "fs";

import {createRequire} from 'module';

const require = createRequire(import.meta.url);
const contentScriptPath = require.resolve('./node_modules/@duckduckgo/autoconsent/dist/autoconsent.playwright.js');
const contentScript = fs.readFileSync(contentScriptPath, 'utf8');

async function injectContentScript(frame) {
  try {
    await frame.evaluate(contentScript);
  } catch (error) {
    console.error('Failed to inject content script into frame:', error.message);
  }
}

async function waitForCondition(conditionFn, interval = 50, timeout = 10000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    if (await conditionFn()) return true;
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  return false;
}

/* Configuration passed to autoconsent's `initResp` message.
   See https://github.com/duckduckgo/autoconsent/blob/main/api.md */
const autoconsentConfig = Object.freeze({
  /* activate consent rule matching */
  enabled: true,
  /* automatically reject (opt-out) all cookies */
  autoAction: 'optOut',
  /* hide banners early via CSS before detection finishes */
  enablePrehide: true,
  /* apply CSS-only rules that hide popups lacking a reject button */
  enableCosmeticRules: true,
  /* enable rules auto-generated from common CMP patterns */
  enableGeneratedRules: true,
  /* fall back to heuristic click when no specific rule matches */
  enableHeuristicAction: true,
  /* skip bundled ABP/uBO cosmetic filter list (saves bundle size) */
  enableFilterList: false,
  /* how many times to retry CMP detection (~50 ms apart) */
  detectRetries: 20,
  logs: {
    /* CMP detection / opt-out lifecycle events */
    lifecycle: false,
    /* individual rule step execution */
    rulesteps: false,
    /* eval snippet calls */
    evals: false,
    /* rule errors */
    errors: false,
    /* background ↔ content-script messages */
    messages: false
  }
})

export async function optOutConsent(page, gotoUrl) {
  const receivedMessages = [];
  const isMessageReceived = (msg) =>
    receivedMessages.some((m) =>
      Object.keys(msg).every((k) => m[k] === msg[k])
    );

  let detectedCmp = null;

  async function messageCallback(msg) {
    receivedMessages.push(msg);

    switch (msg.type) {
      case 'init':
        await page.evaluate((config) => {
          window.autoconsentReceiveMessage({ type: 'initResp', config });
        }, autoconsentConfig);
        break;
      
      case 'eval':
        let result = false;
        try {
          result = await page.evaluate(message.code);
        } catch {}
        await page.evaluate((id, result) => {
          window.autoconsentReceiveMessage({ type: 'evalResp', id, result });
        }, message.id, result);
        break;

      case 'cmpDetected':
        detectedCmp = msg.cmp;
        break;

      case 'optOutResult':
        console.log('Opt-out result:', msg.result);
        break;

      case 'autoconsentDone':
        console.log('Autoconsent process completed.');
        break;

      case 'autoconsentError':
        console.error('Autoconsent error:', msg.details);
        break;
    }
  }

  try {
    await gotoUrl();

    await page.exposeFunction('autoconsentSendMessage', messageCallback);

    await injectContentScript(page);

    for (const frame of page.mainFrame().childFrames()) {
      await injectContentScript(frame);
    }

    const cmpDetected = await waitForCondition(() =>
      isMessageReceived({ type: 'cmpDetected' })
    );
    if (!cmpDetected) {
      console.error('CMP not detected.');
      return;
    }
    console.log(`CMP detected: ${detectedCmp}`);

    const optOutResult = await waitForCondition(() =>
      isMessageReceived({ type: 'optOutResult', result: true })
    );
    if (optOutResult) {
      console.log('Successfully opted out.');
    } else {
      console.error('Failed to opt out.');
    }
  } catch (error) {
    console.error('Error during opt-out script execution:', error);
  }
}
