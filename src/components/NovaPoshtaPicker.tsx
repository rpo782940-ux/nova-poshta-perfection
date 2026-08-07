import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronDown, Loader2, Search } from "lucide-react";
import {
  npAreas,
  npCities,
  npStreets,
  npWarehouses,
  type NpOption,
  type NpPoint,
} from "@/lib/novaposhta.functions";
import { t } from "@/lib/i18n";
import type { Lang } from "@/lib/site";

export type NpSelection = { area: string; city: string; warehouse: string };

const field =
  "w-full rounded-lg border border-input bg-background px-3 py-2.5 text-left text-sm outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-ring/25 disabled:opacity-50";

/** Searchable dropdown used for regions, settlements and delivery points. */
function Combo({
  value,
  placeholder,
  options,
  disabled,
  loading,
  emptyLabel,
  onSelect,
  onSearch,
}: {
  value: string;
  placeholder: string;
  options: { key: string; label: string; hint?: string }[];
  disabled?: boolean;
  loading?: boolean;
  emptyLabel: string;
  onSelect: (key: string, label: string) => void;
  /** When provided, filtering happens on the server (official directory search). */
  onSearch?: (q: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  useEffect(() => {
    if (!onSearch) return;
    const id = setTimeout(() => onSearch(q), 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const filtered = useMemo(() => {
    if (onSearch) return options.slice(0, 150);
    const needle = q.trim().toLowerCase();
    const list = needle
      ? options.filter((o) => o.label.toLowerCase().includes(needle))
      : options;
    return list.slice(0, 150);
  }, [q, options, onSearch]);

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`${field} flex items-center justify-between gap-2`}
      >
        <span className={value ? "truncate" : "truncate text-muted-foreground"}>
          {value || placeholder}
        </span>
        {loading ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
        ) : (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {open && !disabled && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-lift">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={placeholder}
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 && !loading && (
              <li className="px-3 py-3 text-sm text-muted-foreground">{emptyLabel}</li>
            )}
            {loading && (
              <li className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> …
              </li>
            )}
            {filtered.map((o) => (
              <li key={o.key}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(o.key, o.label);
                    setOpen(false);
                    setQ("");
                  }}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  {o.label === value && <Check className="mt-0.5 size-3.5 text-accent" />}
                  <span className="flex-1">
                    {o.label}
                    {o.hint && (
                      <span className="block text-xs text-muted-foreground">{o.hint}</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

type Mode = "branch" | "postomat" | "courier";

/** Live Nova Poshta address picker: region → settlement → branch / postomat / courier. */
export function NovaPoshtaPicker({
  lang,
  onChange,
}: {
  lang: Lang;
  onChange: (value: NpSelection) => void;
}) {
  const getAreas = useServerFn(npAreas);
  const getCities = useServerFn(npCities);
  const getWarehouses = useServerFn(npWarehouses);
  const getStreets = useServerFn(npStreets);

  const [areas, setAreas] = useState<NpOption[]>([]);
  const [cities, setCities] = useState<NpOption[]>([]);
  const [points, setPoints] = useState<NpPoint[]>([]);
  const [streets, setStreets] = useState<NpOption[]>([]);

  const [area, setArea] = useState<NpOption | null>(null);
  const [city, setCity] = useState<NpOption | null>(null);
  const [mode, setMode] = useState<Mode>("branch");
  const [point, setPoint] = useState("");
  const [street, setStreet] = useState("");
  const [house, setHouse] = useState("");

  const [loading, setLoading] = useState<"areas" | "cities" | "points" | null>("areas");
  // Guards against out-of-order directory responses overwriting a newer search.
  const cityReq = useRef(0);
  const pointReq = useRef(0);

  useEffect(() => {
    setLoading("areas");
    getAreas({ data: { lang } })
      .then(setAreas)
      .catch(() => setAreas([]))
      .finally(() => setLoading(null));
  }, [getAreas, lang]);

  const loadCities = (search: string) => {
    if (!area) return;
    const req = ++cityReq.current;
    setLoading("cities");
    getCities({ data: { areaRef: area.ref, search, lang } })
      .then((rows) => {
        if (req === cityReq.current) setCities(rows);
      })
      .catch(() => {
        if (req === cityReq.current) setCities([]);
      })
      .finally(() => {
        if (req === cityReq.current) setLoading(null);
      });
  };

  const loadPoints = (search: string, postomat: boolean) => {
    if (!city) return;
    const req = ++pointReq.current;
    setLoading("points");
    getWarehouses({ data: { settlementRef: city.ref, search, postomat, lang } })
      .then((rows) => {
        if (req === pointReq.current) setPoints(rows);
      })
      .catch(() => {
        if (req === pointReq.current) setPoints([]);
      })
      .finally(() => {
        if (req === pointReq.current) setLoading(null);
      });
  };

  // Region changed → reset everything below it.
  useEffect(() => {
    setCities([]);
    setCity(null);
    setPoints([]);
    setPoint("");
    if (area) loadCities("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [area]);

  // Settlement changed → reload delivery points for the current mode.
  useEffect(() => {
    setPoints([]);
    setPoint("");
    setStreets([]);
    setStreet("");
    if (city && mode !== "courier") loadPoints("", mode === "postomat");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city]);

  const emit = (next: Partial<NpSelection>) =>
    onChange({
      area: area?.name ?? "",
      city: city?.name ?? "",
      warehouse: "",
      ...next,
    });

  const modes: { id: Mode; label: string }[] = [
    { id: "branch", label: t("npBranch", lang) },
    { id: "postomat", label: t("npPostomat", lang) },
    { id: "courier", label: t("npCourier", lang) },
  ];

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-3">
      {/* 1 — region */}
      <Combo
        value={area?.name ?? ""}
        placeholder={t("npRegion", lang)}
        options={areas.map((a) => ({ key: a.ref, label: a.name }))}
        loading={loading === "areas"}
        emptyLabel={t("nothingFound", lang)}
        onSelect={(key, label) => {
          setArea({ ref: key, name: label });
          onChange({ area: label, city: "", warehouse: "" });
        }}
      />

      {/* 2 — settlement (official directory search on the server) */}
      <Combo
        value={city?.name ?? ""}
        placeholder={t("npCity", lang)}
        options={cities.map((c) => ({ key: c.ref, label: c.name, hint: c.hint }))}
        disabled={!area}
        loading={loading === "cities"}
        emptyLabel={t("nothingFound", lang)}
        onSearch={(q) => loadCities(q)}
        onSelect={(key, label) => {
          setCity({ ref: key, name: label });
          onChange({ area: area?.name ?? "", city: label, warehouse: "" });
        }}
      />

      {/* 3 — branch / postomat / courier */}
      <div className="grid grid-cols-3 gap-1.5 rounded-lg bg-background p-1">
        {modes.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => {
              setMode(m.id);
              setPoint("");
              setStreet("");
              setHouse("");
              setPoints([]);
              emit({ warehouse: "" });
              if (m.id !== "courier" && city) loadPoints("", m.id === "postomat");
            }}
            className={`rounded-md px-2 py-2 text-xs font-semibold transition-colors ${
              mode === m.id
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === "courier" ? (
        <div className="grid gap-2 sm:grid-cols-[1fr_120px]">
          <Combo
            value={street}
            placeholder={t("npStreet", lang)}
            options={streets.map((s) => ({ key: s.ref, label: s.name }))}
            disabled={!city}
            emptyLabel={t("npTypeStreet", lang)}
            onSearch={(q) => {
              if (!city || q.trim().length < 2) return;
              getStreets({ data: { settlementRef: city.ref, search: q, lang } })
                .then(setStreets)
                .catch(() => setStreets([]));
            }}
            onSelect={(_key, label) => {
              setStreet(label);
              emit({ warehouse: [label, house].filter(Boolean).join(", ") });
            }}
          />
          <input
            className={field}
            placeholder={t("npHouse", lang)}
            value={house}
            maxLength={40}
            onChange={(e) => {
              setHouse(e.target.value);
              emit({ warehouse: [street, e.target.value].filter(Boolean).join(", ") });
            }}
          />
        </div>
      ) : (
        <Combo
          value={point}
          placeholder={mode === "postomat" ? t("npPostomat", lang) : t("npWarehouse", lang)}
          options={points.map((p) => ({ key: p.ref, label: p.name }))}
          disabled={!city}
          loading={loading === "points"}
          emptyLabel={t("npNoPoints", lang)}
          onSearch={(q) => loadPoints(q, mode === "postomat")}
          onSelect={(_key, label) => {
            setPoint(label);
            emit({ warehouse: label });
          }}
        />
      )}
    </div>
  );
}
