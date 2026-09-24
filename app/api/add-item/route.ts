import { NextRequest, NextResponse } from "next/server";
import { appendRow } from "@/lib/sheets";
import { isAuthenticated } from "@/lib/auth";

export const runtime = "nodejs";

function formatPriceCell(usd: number, cny: number): string {
  const cnyStr = cny.toFixed(2).replace(".", ",");
  return `$${usd.toFixed(2)} ,¥${cnyStr}`;
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { title, link, image, category, brand, usd, cny, seller, dateAdded } = body as {
    title?: string;
    link?: string;
    image?: string;
    category?: string;
    brand?: string;
    usd?: number | string;
    cny?: number | string;
    seller?: string;
    dateAdded?: string;
  };

  if (!title?.trim() || !link?.trim() || !image?.trim()) {
    return NextResponse.json(
      { error: "Title, link, and image are required." },
      { status: 400 }
    );
  }

  const usdNum = Number(usd);
  const cnyNum = Number(cny);
  if (!Number.isFinite(usdNum) || !Number.isFinite(cnyNum)) {
    return NextResponse.json(
      { error: "USD and CNY price must both be numbers." },
      { status: 400 }
    );
  }

  const priceStr = formatPriceCell(usdNum, cnyNum);
  const escapedImage = image.trim().replace(/"/g, '\\"');
  const idFormula = `=IMAGE("${escapedImage}")`;
  const finalDate = dateAdded?.trim() || new Date().toISOString().slice(0, 10);

  const rowValues = [
    idFormula,
    title.trim(),
    link.trim(),
    image.trim(),
    category?.trim() || "",
    brand?.trim() || "",
    priceStr,
    seller?.trim() || "",
    "",
    "",
    finalDate,
  ];

  try {
    await appendRow(rowValues);
    return NextResponse.json({ ok: true, price: priceStr });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
