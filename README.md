# fashionsea admin -- add item

A small password-protected site for adding new items to the fashionsea
Google Sheet, one at a time. Fill in the fields, optionally auto-fetch the
price from the kakobuy link, submit -- it appends a new row to the sheet.

- `/add` -- the form (redirect target for `/`)
- `/login` -- password gate

**No `middleware.ts`, by design.** Next.js's compiled middleware output hits
an unresolved upstream bug (github.com/vercel/next.js/issues/86434) where
Vercel's Node.js runtime tries to `require()` it despite it containing ES
`import` syntax. Auth is checked directly in `app/add/page.tsx` (server
component) and at the top of each API route via `lib/auth.ts` instead.

## Local development

```bash
npm install
npx playwright install chromium   # only needed to test the price-fetch route locally
cp .env.local.example .env.local  # then fill in real values
npm run dev
```

## Environment variables (5 required)

| Variable | Where it comes from |
|---|---|
| `SITE_PASSWORD` | Pick anything -- this is what you type to log in |
| `SESSION_SECRET` | Any long random string (a generated one is in the deploy instructions) |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | From `credentials.json` -- the `client_email` field |
| `GOOGLE_PRIVATE_KEY` | From `credentials.json` -- the `private_key` field, pasted whole |
| `GOOGLE_SHEET_ID` | The ID in your sheet's URL |

`GOOGLE_SHEET_TAB_NAME` is optional -- it auto-detects the sheet's first tab.

Reuse the same service account you already created for `update_prices.py` --
it's already shared with your sheet as an Editor.

## Deploying

1. Push this folder to a GitHub repo (or `vercel --prod` directly, no GitHub needed).
2. On vercel.com, import it as a **new** project.
3. Add all 5 environment variables before the first deploy.
4. Deploy.

## If auto-fetch prices come back empty

kakobuy renders prices with JavaScript, and the CSS selectors in
`app/api/scrape-price/route.ts` (the `selectors` array) were guessed, not
verified against the live site. If most fetches report "no price found",
inspect a real kakobuy product page (right-click the price -> Inspect) and
add its actual selector to that list. Manual price entry always works
regardless.
