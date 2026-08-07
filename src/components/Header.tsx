import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Menu, Phone, Search, ShoppingCart, X } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/lib/cart";
import { t } from "@/lib/i18n";
import { CATEGORIES, CONTACTS, href, pageNav, type Lang } from "@/lib/site";

export function Header({ lang }: { lang: Lang }) {
  const [open, setOpen] = useState(false);
  const [cats, setCats] = useState(false);
  const [q, setQ] = useState("");
  const { count, ready } = useCart();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = q.trim();
    if (query.length < 2) return;
    setOpen(false);
    void navigate({ to: href("/search", lang), search: { q: query } });
  };


  const other: Lang = lang === "uk" ? "ru" : "uk";
  const altPath =
    other === "uk"
      ? `/uk${pathname === "/" ? "" : pathname}` || "/uk"
      : pathname.replace(/^\/uk/, "") || "/";

  const nav = [
    { to: href("/products.php", lang), label: t("products", lang) },
    { to: href("/tecnology.php", lang), label: t("technology", lang) },
    { to: href("/oplata-dostavka.php", lang), label: t("payment", lang) },
    { to: href("/kontacts.php", lang), label: t("contacts", lang) },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="bg-steel text-steel-foreground">
        <div className="container-page flex h-9 items-center justify-between gap-4 text-xs">
          <span className="hidden truncate opacity-80 sm:block">
            {t("brandTagline", lang)} — {lang === "uk" ? CONTACTS.addressUk : CONTACTS.addressRu}
          </span>
          <div className="flex items-center gap-4">
            <a
              href={`tel:${CONTACTS.phones[0].replace(/[^+\d]/g, "")}`}
              className="flex items-center gap-1.5 font-medium hover:text-accent"
            >
              <Phone className="size-3.5" aria-hidden />
              {CONTACTS.phones[0]}
            </a>
            <div className="flex items-center overflow-hidden rounded-sm border border-steel-foreground/25">
              <span className="bg-accent px-2 py-0.5 font-semibold text-accent-foreground uppercase">
                {lang}
              </span>
              <a href={altPath} className="px-2 py-0.5 uppercase hover:bg-steel-foreground/10">
                {other}
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link to={href("/", lang)} className="flex items-center gap-3">
          <img
            src="/brand/logo.png"
            alt="TechnoForma"
            width={184}
            height={60}
            className="h-10 w-auto sm:h-11"
          />
        </Link>


        <nav className="hidden items-center gap-1 lg:flex">
          <button
            onClick={() => setCats((v) => !v)}
            className="rounded-sm px-3 py-2 text-sm font-medium hover:bg-muted"
            aria-expanded={cats}
          >
            {t("catalog", lang)}
          </button>
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="rounded-sm px-3 py-2 text-sm font-medium hover:bg-muted"
              activeProps={{ className: "bg-muted" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <form
          onSubmit={submitSearch}
          className="hidden min-w-0 flex-1 max-w-xs items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 transition-colors focus-within:border-accent focus-within:ring-2 focus-within:ring-ring/25 xl:flex"
          role="search"
        >
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("searchPlaceholder", lang)}
            aria-label={t("search", lang)}
            maxLength={120}
            className="w-full bg-transparent text-sm outline-none"
          />
        </form>

        <div className="flex items-center gap-2">
          <Link
            to={href("/search", lang)}
            search={{ q: "" }}
            aria-label={t("search", lang)}
            className="rounded-sm border border-border p-2 xl:hidden"
          >
            <Search className="size-5" />
          </Link>

          <Link
            to={href("/cart", lang)}
            className="relative inline-flex items-center gap-2 rounded-sm bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <ShoppingCart className="size-4" aria-hidden />
            <span className="hidden sm:inline">{t("cart", lang)}</span>
            {ready && count > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-accent-foreground">
                {count}
              </span>
            )}
          </Link>
          <button
            className="rounded-sm border border-border p-2 lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="menu"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {cats && (
        <div className="hidden border-t border-border bg-card lg:block">
          <div className="container-page grid grid-cols-3 gap-x-8 gap-y-1 py-5">
            {CATEGORIES.map((c) => (
              <Link
                key={c.slug}
                to={href(`/${c.slug}.php`, lang)}
                onClick={() => setCats(false)}
                className="rounded-sm px-2 py-1.5 text-sm hover:bg-muted"
              >
                {pageNav(c, lang)}
              </Link>
            ))}
          </div>
        </div>
      )}

      {open && (
        <div className="border-t border-border bg-card lg:hidden">
          <div className="container-page flex flex-col py-3">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className="border-b border-border py-2.5 text-sm font-medium"
              >
                {n.label}
              </Link>
            ))}
            <span className="pt-3 pb-1 text-xs font-semibold text-muted-foreground uppercase">
              {t("catalog", lang)}
            </span>
            {CATEGORIES.map((c) => (
              <Link
                key={c.slug}
                to={href(`/${c.slug}.php`, lang)}
                onClick={() => setOpen(false)}
                className="py-2 text-sm"
              >
                {pageNav(c, lang)}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
