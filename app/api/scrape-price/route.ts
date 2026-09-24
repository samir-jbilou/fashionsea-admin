import { NextRequest, NextResponse } from "next/server";
import { chromium } from "playwright-core";
import chromiumBinary from "@sparticuz/chromium";
import { isAuthenticated } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 45;

const DEAD_PHRASES = [
  "item not found",
  "商品不存在",
  "商品已下架",
  "page not found",
  "该商品已下架",
  "宝贝已下架",
];

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const FALLBACK_CNY_PER_USD = 7.1;

function parsePagePrices(text: string): { cny: number | null; usd: number | null } {
  let cny: number | null = null;
  const cnyMatch = text.match(/[¥￥]\s*(\d+(?:[.,]\d{1,2})?)/);
  if (cnyMatch) {
    const v = parseFloat(cnyMatch[1].replace(",", "."));
    if (!Number.isNaN(v)) cny = v;
  }

  let usd: number | null = null;
  const usdMatch = text.match(/\$\s*(\d+(?:\.\d{1,2})?)/);
  if (usdMatch) {
    const v = parseFloat(usdMatch[1]);
    if (!Number.isNaN(v)) usd = v;
  }

  return { cny, usd };
}

async function getLiveCnyToUsdRate(): Promise<number | null> {
  try {
    const res = await fetch(
      "https://api.frankfurter.dev/v1/latest?base=CNY&symbols=USD",
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const rate = data?.rates?.USD;
    return typeof rate === "number" ? rate : null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ status: "error", detail: "Not signed in." }, { status: 401 });
  }

  const { link } = await req.json().catch(() => ({ link: "" }));

  if (!link || typeof link !== "string") {
    return NextResponse.json({ status: "error", detail: "Missing link" }, { status: 400 });
  }

  let browser;
  try {
    const executablePath = await chromiumBinary.executablePath();
    browser = await chromium.launch({
      args: chromiumBinary.args,
      executablePath,
      headless: true,
    });

    const context = await browser.newContext({ userAgent: USER_AGENT });
    const page = await context.newPage();

    await page.route("**/*", (route) => {
      const type = route.request().resourceType();
      if (type === "image" || type === "font") {
        route.abort();
      } else {
        route.continue();
      }
    });

    let response;
    try {
      response = await page.goto(link, { timeout: 25000, waitUntil: "networkidle" });
    } catch {
      response = null;
    }

    if (response && response.status() >= 400) {
      return NextResponse.json({ status: "dead", detail: `HTTP ${response.status()}` });
    }

    await page.waitForTimeout(2000);

    const bodyText = await page.innerText("body").catch(() => "");
    const lowered = bodyText.toLowerCase();

    if (DEAD_PHRASES.some((p) => lowered.includes(p))) {
      return NextResponse.json({
        status: "dead",
        detail: "page loaded but item appears removed/delisted",
      });
    }

    let cny: number | null = null;
    let usd: number | null = null;
    let detail = "";

    const selectors = ["[class*='price']", "[class*='Price']", "#price", ".goods-price"];
    for (const sel of selectors) {
      try {
        const el = page.locator(sel).first();
        if ((await el.count()) > 0) {
          const txt = await el.innerText({ timeout: 2000 });
          const parsed = parsePagePrices(txt);
          if (parsed.cny !== null) {
            cny = parsed.cny;
            usd = parsed.usd;
            detail = `matched selector '${sel}'`;
            break;
          }
        }
      } catch {
        continue;
      }
    }

    if (cny === null) {
      const parsed = parsePagePrices(bodyText);
      if (parsed.cny !== null) {
        cny = parsed.cny;
        usd = parsed.usd;
        detail = "matched via full-page text scan";
      }
    }

    if (cny === null) {
      return NextResponse.json({
        status: "ok",
        cny: null,
        usd: null,
        detail: "page loaded but no ¥ price found on it",
      });
    }

    let usdSource: "page" | "computed" = "page";
    if (usd === null) {
      const rate = await getLiveCnyToUsdRate();
      usd = Math.round(cny * (rate ?? 1 / FALLBACK_CNY_PER_USD) * 100) / 100;
      usdSource = "computed";
    }

    return NextResponse.json({ status: "ok", cny, usd, usdSource, detail });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ status: "error", detail: message }, { status: 500 });
  } finally {
    if (browser) await browser.close();
  }
}
