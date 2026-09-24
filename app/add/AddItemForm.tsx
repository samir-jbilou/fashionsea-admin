"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type PriceMode = "manual" | "auto";

type ScrapeResult = {
  status: "ok" | "dead" | "error";
  cny: number | null;
  usd: number | null;
  usdSource?: "page" | "computed";
  detail: string;
};

const todayISO = () => new Date().toISOString().slice(0, 10);

const emptyForm = {
  title: "",
  link: "",
  image: "",
  category: "",
  brand: "",
  seller: "",
  usd: "",
  cny: "",
  dateAdded: todayISO(),
};

export default function AddItemForm() {
  const router = useRouter();
  const [form, setForm] = useState(emptyForm);
  const [priceMode, setPriceMode] = useState<PriceMode>("manual");
  const [fetching, setFetching] = useState(false);
  const [fetchNote, setFetchNote] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleFetchPrice() {
    if (!form.link.trim()) {
      setFetchNote("Paste a link first.");
      return;
    }
    setFetching(true);
    setFetchNote(null);
    try {
      const res = await fetch("/api/scrape-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ link: form.link.trim() }),
      });
      const data: ScrapeResult = await res.json();

      if (data.status === "dead") {
        setFetchNote(`Link looks broken: ${data.detail}`);
      } else if (data.status === "error") {
        setFetchNote(`Couldn't fetch: ${data.detail}`);
      } else if (data.cny === null) {
        setFetchNote(`Link is alive, but no price was found: ${data.detail}`);
      } else {
        setForm((f) => ({
          ...f,
          cny: String(data.cny),
          usd: data.usd !== null ? String(data.usd) : f.usd,
        }));
        const sourceNote =
          data.usdSource === "computed"
            ? " (USD converted from CNY -- kakobuy didn't show its own USD price)"
            : "";
        setFetchNote(`Found: ¥${data.cny} · $${data.usd}${sourceNote}`);
      }
    } catch {
      setFetchNote("Couldn't reach the price checker. Try again, or enter it manually.");
    } finally {
      setFetching(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setSuccessMsg(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/add-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || "Something went wrong.");
        return;
      }
      setSuccessMsg(`Added -- price saved as ${data.price}`);
      setForm({ ...emptyForm, dateAdded: todayISO() });
      setFetchNote(null);
    } catch {
      setSubmitError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const priceFilled = form.usd !== "" && form.cny !== "";

  return (
    <div className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-sm tracking-wide text-muted">fashionsea</p>
            <h1 className="text-2xl font-semibold">Add an item</h1>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-muted hover:text-foreground transition-colors"
          >
            Sign out
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Field label="Title" required>
            <input
              required
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              className={inputClass}
              placeholder="FF NUMBER NINE INSPIRED PANTS"
            />
          </Field>

          <Field label="Kakobuy link" required>
            <input
              required
              type="url"
              value={form.link}
              onChange={(e) => update("link", e.target.value)}
              className={inputClass}
              placeholder="https://www.kakobuy.com/item/..."
            />
          </Field>

          <Field label="Image URL" required>
            <input
              required
              type="url"
              value={form.image}
              onChange={(e) => update("image", e.target.value)}
              className={inputClass}
              placeholder="https://cbu01.alicdn.com/..."
            />
            {form.image.trim() && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={form.image.trim()}
                alt=""
                className="mt-3 h-32 w-32 rounded-md border border-border object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            )}
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Category">
              <input
                value={form.category}
                onChange={(e) => update("category", e.target.value)}
                className={inputClass}
                placeholder="Pants"
              />
            </Field>
            <Field label="Brand">
              <input
                value={form.brand}
                onChange={(e) => update("brand", e.target.value)}
                className={inputClass}
                placeholder="Number Nine"
              />
            </Field>
          </div>

          <Field label="Seller">
            <input
              value={form.seller}
              onChange={(e) => update("seller", e.target.value)}
              className={inputClass}
              placeholder="MADEBYSWAG"
            />
          </Field>

          <div className="border border-border rounded-md p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm text-muted">Price</span>
              <div className="flex rounded-md border border-border overflow-hidden text-sm">
                <button
                  type="button"
                  onClick={() => setPriceMode("manual")}
                  className={`px-3 py-1.5 transition-colors ${
                    priceMode === "manual" ? "bg-accent text-background" : "text-muted"
                  }`}
                >
                  Manual
                </button>
                <button
                  type="button"
                  onClick={() => setPriceMode("auto")}
                  className={`px-3 py-1.5 transition-colors ${
                    priceMode === "auto" ? "bg-accent text-background" : "text-muted"
                  }`}
                >
                  Auto-fetch
                </button>
              </div>
            </div>

            {priceMode === "auto" && (
              <button
                type="button"
                onClick={handleFetchPrice}
                disabled={fetching || !form.link.trim()}
                className="mb-3 w-full rounded-md border border-accent px-3 py-2 text-sm text-accent transition-colors hover:bg-accent hover:text-background disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {fetching ? "Visiting link..." : "Fetch price from link"}
              </button>
            )}

            {fetchNote && <p className="mb-3 text-sm text-muted">{fetchNote}</p>}

            <div className="grid grid-cols-2 gap-4">
              <Field label="USD ($)" required>
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.usd}
                  onChange={(e) => update("usd", e.target.value)}
                  className={inputClass}
                  placeholder="18.46"
                />
              </Field>
              <Field label="CNY" required>
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.cny}
                  onChange={(e) => update("cny", e.target.value)}
                  className={inputClass}
                  placeholder="119.99"
                />
              </Field>
            </div>
            {priceFilled && (
              <p className="mt-2 text-xs text-muted">
                Will be saved as: ${Number(form.usd).toFixed(2)} ,¥
                {Number(form.cny).toFixed(2).replace(".", ",")}
              </p>
            )}
          </div>

          <Field label="Date added">
            <input
              type="date"
              value={form.dateAdded}
              onChange={(e) => update("dateAdded", e.target.value)}
              className={inputClass}
            />
          </Field>

          {submitError && <p className="text-sm text-danger">{submitError}</p>}
          {successMsg && <p className="text-sm text-accent">{successMsg}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-accent px-4 py-3 font-medium text-background transition-colors hover:bg-accent-strong disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Adding..." : "Add to sheet"}
          </button>
        </form>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-border bg-surface px-3 py-2.5 text-foreground outline-none focus:border-accent transition-colors";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-muted">
        {label}
        {required && <span className="text-accent"> *</span>}
      </span>
      {children}
    </label>
  );
}
