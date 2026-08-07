import { Link } from "@tanstack/react-router";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { placeOrder } from "@/lib/orders.functions";
import { NovaPoshtaPicker } from "@/components/NovaPoshtaPicker";
import { useCart } from "@/lib/cart";
import { fmtPrice, t } from "@/lib/i18n";
import { href, type Lang } from "@/lib/site";

export function CartView({ lang }: { lang: Lang }) {
  const { lines, setQty, remove, total, clear, ready } = useCart();
  const [form, setForm] = useState({
    customer_name: "",
    phone: "",
    email: "",
    city: "",
    delivery: "novaposhta",
    comment: "",
  });
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const send = useServerFn(placeOrder);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customer_name.trim() || !form.phone.trim()) return;
    setState("sending");
    try {
      await send({
        data: {
          customer_name: form.customer_name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim() || null,
          city: form.city.trim() || null,
          delivery: form.delivery as "novaposhta" | "pickup" | "carrier",
          comment: form.comment.trim() || null,
          lang,
          items: lines.map((l) => ({
            name: l.name,
            variant: l.variant,
            price: l.price,
            qty: l.qty,
          })),
        },
      });
      clear();
      setState("done");
    } catch {
      setState("error");
    }
  };

  if (!ready) return <div className="container-page py-20" />;

  if (state === "done")
    return (
      <div className="container-page py-24 text-center">
        <h1 className="font-display text-2xl font-bold">{t("orderOk", lang)}</h1>
        <Link
          to={href("/products.php", lang)}
          className="mt-6 inline-block rounded-sm bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          {t("continueShopping", lang)}
        </Link>
      </div>
    );

  if (lines.length === 0)
    return (
      <div className="container-page py-24 text-center">
        <ShoppingCart className="mx-auto size-10 text-muted-foreground" aria-hidden />
        <h1 className="mt-4 font-display text-2xl font-bold">{t("emptyCart", lang)}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("emptyCartHint", lang)}</p>
        <Link
          to={href("/products.php", lang)}
          className="mt-6 inline-block rounded-sm bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          {t("toCatalog", lang)}
        </Link>
      </div>
    );

  const input =
    "w-full rounded-sm border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-ring/30";

  return (
    <div className="container-page py-10">
      <h1 className="font-display text-2xl font-bold">{t("cart", lang)}</h1>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
        <ul className="space-y-3">
          {lines.map((l) => (
            <li
              key={l.key}
              className="flex gap-4 rounded-md border border-border bg-card p-3 shadow-plate"
            >
              <img
                src={l.image}
                alt={l.name}
                loading="lazy"
                width={96}
                height={96}
                className="size-24 shrink-0 rounded-lg bg-concrete object-contain p-1"
              />
              <div className="flex flex-1 flex-col">
                <h2 className="font-display text-sm font-semibold">{l.name}</h2>
                {l.variant && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t("variant", lang)}: {l.variant}
                  </p>
                )}
                <div className="mt-auto flex items-center justify-between gap-3 pt-2">
                  <div className="flex items-center rounded-sm border border-border">
                    <button
                      onClick={() => setQty(l.key, l.qty - 1)}
                      className="p-1.5 hover:bg-muted"
                      aria-label="-"
                    >
                      <Minus className="size-3.5" />
                    </button>
                    <span className="w-9 text-center text-sm font-semibold">{l.qty}</span>
                    <button
                      onClick={() => setQty(l.key, l.qty + 1)}
                      className="p-1.5 hover:bg-muted"
                      aria-label="+"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                  <span className="font-display text-base font-bold">
                    {fmtPrice(l.price * l.qty, lang)} {t("uah", lang)}
                  </span>
                  <button
                    onClick={() => remove(l.key)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={t("remove", lang)}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <form
          onSubmit={submit}
          className="h-fit space-y-3 rounded-md border border-border bg-card p-5 shadow-plate lg:sticky lg:top-28"
        >
          <div className="flex items-baseline justify-between border-b border-border pb-3">
            <span className="text-sm text-muted-foreground">{t("total", lang)}</span>
            <span className="font-display text-2xl font-bold">
              {fmtPrice(total, lang)} {t("uah", lang)}
            </span>
          </div>

          <input
            required
            className={input}
            placeholder={t("name", lang)}
            value={form.customer_name}
            maxLength={120}
            onChange={(e) => set("customer_name", e.target.value)}
          />
          <input
            required
            type="tel"
            className={input}
            placeholder={t("phoneHint", lang)}
            value={form.phone}
            maxLength={40}
            onChange={(e) => set("phone", e.target.value)}
          />
          <input
            type="email"
            className={input}
            placeholder={t("email", lang)}
            value={form.email}
            maxLength={160}
            onChange={(e) => set("email", e.target.value)}
          />
          <select
            className={input}
            value={form.delivery}
            onChange={(e) => set("delivery", e.target.value)}
          >
            <option value="novaposhta">{t("novaposhta", lang)}</option>
            <option value="pickup">{t("pickup", lang)}</option>
            <option value="carrier">{t("carrier", lang)}</option>
          </select>
          {form.delivery === "novaposhta" ? (
            <NovaPoshtaPicker
              lang={lang}
              onChange={(np) =>
                set("city", [np.city, np.warehouse].filter(Boolean).join(", "))
              }
            />

          ) : (
            <input
              className={input}
              placeholder={t("city", lang)}
              value={form.city}
              maxLength={120}
              onChange={(e) => set("city", e.target.value)}
            />
          )}
          <textarea
            className={input}
            rows={3}
            placeholder={t("comment", lang)}
            value={form.comment}
            maxLength={1000}
            onChange={(e) => set("comment", e.target.value)}
          />

          {state === "error" && (
            <p className="text-sm text-destructive">{t("orderErr", lang)}</p>
          )}

          <button
            type="submit"
            disabled={state === "sending"}
            className="w-full rounded-sm bg-accent px-5 py-3 text-sm font-bold text-accent-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-60"
          >
            {state === "sending" ? t("sending", lang) : t("submitOrder", lang)}
          </button>
        </form>
      </div>
    </div>
  );
}
