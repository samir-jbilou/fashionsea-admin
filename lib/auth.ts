import { cookies } from "next/headers";

/** Checks the session cookie server-side. No middleware/proxy.ts is used in
 * this project (see README) because it hits an unresolved Next.js/Vercel
 * packaging bug. This runs directly in pages and route handlers instead. */
export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get("session")?.value;
  const expected = process.env.SESSION_SECRET;
  return Boolean(expected && cookie && cookie === expected);
}
