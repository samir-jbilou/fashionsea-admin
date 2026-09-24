import { JWT } from "google-auth-library";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

function getAuthClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!email || !rawKey) {
    throw new Error(
      "Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY environment variables."
    );
  }

  const key = rawKey.includes("\\n") ? rawKey.replace(/\\n/g, "\n") : rawKey;

  return new JWT({ email, key, scopes: SCOPES });
}

async function getTabName(sheetId: string, accessToken: string): Promise<string> {
  const override = process.env.GOOGLE_SHEET_TAB_NAME?.trim();
  if (override) return override;

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Couldn't look up the sheet's tab name (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const title = data?.sheets?.[0]?.properties?.title;
  if (!title) {
    throw new Error("Couldn't find any tab in this spreadsheet.");
  }
  return title;
}

/**
 * Appends one row to the end of the sheet's first tab, in columns A-K,
 * using USER_ENTERED so a string like =IMAGE("...") is interpreted as a
 * live formula rather than literal text.
 */
export async function appendRow(values: (string | number)[]) {
  const sheetId = process.env.GOOGLE_SHEET_ID;

  if (!sheetId) {
    throw new Error("Missing GOOGLE_SHEET_ID environment variable.");
  }

  const auth = getAuthClient();
  const accessToken = await auth.getAccessToken();
  const tabName = await getTabName(sheetId, accessToken.token!);

  const range = encodeURIComponent(`${tabName}!A:K`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values: [values] }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google Sheets API error (${res.status}): ${errText}`);
  }

  return res.json();
}
