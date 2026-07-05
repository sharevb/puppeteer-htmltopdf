import express from "express";
import bodyParser from "body-parser";
import puppeteer from "puppeteer";
import { resolvePdfOptions } from "./options.js";
import { PuppeteerBlocker } from '@ghostery/adblocker-puppeteer';
import { optOutConsent } from './autoconsent.js';
import fetch from "cross-fetch";
import cors from "cors";

const app = express();

// Parse env vars
function parseList(value, fallback) {
  if (!value) return fallback;
  if (value === "*") return "*";
  return value.split(",").map(v => v.trim());
}

const CORS = process.env.CORS || "*"; 
const HOST = process.env.HOST || "0.0.0.0"; 
const PORT = parseInt(process.env.PORT || "3000", 10); 
const UPLOAD_LIMIT_MB = parseInt(process.env.UPLOAD_LIMIT_MB || "50", 10); 
const BASIC_AUTH = process.env.BASIC_AUTH?.trim();

function parseBasicAuthCredentials(value) {
  if (!value) return null;

  const separatorIndex = value.indexOf(":");
  if (separatorIndex <= 0) {
    return null;
  }

  return {
    username: value.slice(0, separatorIndex),
    password: value.slice(separatorIndex + 1),
  };
}

const credentials = parseBasicAuthCredentials(BASIC_AUTH);
function basicAuthMiddleware(req, res, next) {
  if (!credentials) {
    return next();
  }

  const header = req.get("authorization");
  if (!header || !header.startsWith("Basic ")) {
    res.set("WWW-Authenticate", 'Basic realm="Restricted"');
    return res.status(401).send("Unauthorized");
  }

  const encoded = header.slice(6).trim();
  const decoded = Buffer.from(encoded, "base64").toString("utf8");
  const expected = `${credentials.username}:${credentials.password}`;

  if (decoded !== expected) {
    res.set("WWW-Authenticate", 'Basic realm="Restricted"');
    return res.status(401).send("Unauthorized");
  }

  return next();
}

if (credentials) {
  app.use(basicAuthMiddleware);
}
app.use(bodyParser.json({ limit: `${UPLOAD_LIMIT_MB}mb` }));
app.use(bodyParser.urlencoded({ extended: true }));

// --- CORS configuration ---
app.use(cors({
  origin: parseList(CORS, "*"),
  methods: ["GET"],         // your service only exposes GET /download
  allowedHeaders: ["*"],    // allow all headers
  exposedHeaders: ["Content-Disposition"], // needed so browser can read filename
}));


const blocker = await PuppeteerBlocker.fromPrebuiltAdsAndTracking(fetch);

let browser;
async function getBrowser() {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
  }
  return browser;
}

// -----------------------------
// Healthcheck
// -----------------------------
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

async function applyOnePageLayout(page, pdfOptions) {
    const [ pageWidth, pageHeight ] = await page.evaluate(() => 
        [ document.documentElement.offsetWidth, document.documentElement.offsetHeight ]
    );

    pdfOptions.width = pageWidth + 'px';
    pdfOptions.height = pageHeight + 'px';
    pdfOptions.pageRanges = '1';

    delete pdfOptions.landscape;
    delete pdfOptions.format;
}

// -----------------------------
// URL → PDF
// -----------------------------
app.post("/pdf/url", async (req, res) => {
  const { url, options } = req.body;

  if (!url) {
    return res.status(400).json({ error: "Missing 'url' in body" });
  }

  try {
    const browser = await getBrowser();
    const page = await browser.newPage();

    const pdfOptions = resolvePdfOptions(options);

    if (pdfOptions.language) {
        const cdpSession = await page.createCDPSession();
        await cdpSession.send("Emulation.setLocaleOverride", {
            locale: pdfOptions.language
        });

        await page.setExtraHTTPHeaders({
            "Accept-Language": pdfOptions.language
        });

        await page.evaluateOnNewDocument(lang => {
            Object.defineProperty(navigator, "language", { get: () => lang });
            Object.defineProperty(navigator, "languages", { get: () => [lang] });
        }, pdfOptions.language);
    }

    const gotoUrlOptions = {
        waitUntil: ['load', 'domcontentloaded', "networkidle0"],
        timeout: 30000
      };
    if (pdfOptions.autoHideCookies) {
		  await blocker.enableBlockingInPage(page);
      await optOutConsent(page, () => page.goto(url, gotoUrlOptions));
    } else {
      await page.goto(url, gotoUrlOptions);
    }

    if (pdfOptions.onePage) {
        await applyOnePageLayout(page, pdfOptions);
    }

    const pdf = await page.pdf(pdfOptions);

    await page.close();

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline; filename=output.pdf"
    });

    res.send(pdf);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: `Failed to generate PDF: ${err}` });
  }
});

// -----------------------------
// HTML → PDF
// -----------------------------
app.post("/pdf/html", async (req, res) => {
  const { html, options } = req.body;

  if (!html) {
    return res.status(400).json({ error: "Missing 'html' in body" });
  }

  try {
    const browser = await getBrowser();
    const page = await browser.newPage();

    await page.setContent(html, {
      waitUntil: "networkidle0"
    });

    const pdfOptions = resolvePdfOptions(options);

    if (pdfOptions.onePage) {
        await applyOnePageLayout(page, pdfOptions);
    }

    const pdf = await page.pdf(pdfOptions);

    await page.close();

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline; filename=output.pdf"
    });

    res.send(pdf);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: `Failed to generate PDF: ${err}` });
  }
});

app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});
