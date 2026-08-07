import type { NpCity, NpPoint, NpPointKind } from "./novaposhta-types";

/**
 * Official Nova Poshta API v2.0 (address directories), server side only.
 *
 * The public address directories work without a counterparty key, so the
 * picker keeps working even when NOVAPOSHTA_API_KEY is absent or expired.
 */
const ENDPOINT = "https://api.novaposhta.ua/v2.0/json/";

type NpItem = Record<string, unknown>;

type NpResponse = {
  success: boolean;
  data?: NpItem[];
  errors?: string[];
  info?: { totalCount?: number };
};

/** Small in-process cache — directories change rarely and this kills re-fetch latency. */
const cache = new Map<string, { at: number; value: unknown }>();
const TTL = 10 * 60 * 1000;

function cached<T>(key: string): T | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL) {
    cache.delete(key);
    return null;
  }
  return hit.value as T;
}

function store(key: string, value: unknown) {
  if (cache.size > 300) cache.clear();
  cache.set(key, { at: Date.now(), value });
}

async function request(
  apiKey: string,
  modelName: string,
  calledMethod: string,
  methodProperties: Record<string, unknown>,
): Promise<NpResponse> {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey, modelName, calledMethod, methodProperties }),
  });
  if (!response.ok) throw new Error(`novaposhta_http_${response.status}`);
  return (await response.json()) as NpResponse;
}

async function call(
  modelName: string,
  calledMethod: string,
  methodProperties: Record<string, unknown>,
): Promise<NpResponse> {
  const key = process.env["NOVAPOSHTA_API_KEY"] ?? "";
  let payload = await request(key, modelName, calledMethod, methodProperties);
  // A missing/expired counterparty key must never break the address directories.
  if (!payload.success && key) {
    payload = await request("", modelName, calledMethod, methodProperties);
  }
  if (!payload.success) throw new Error(payload.errors?.join("; ") || "novaposhta_error");
  return payload;
}

const str = (row: NpItem, field: string) =>
  typeof row[field] === "string" ? (row[field] as string) : "";

/** Ukrainian directory strings, transliterated labels are not provided by the API. */
function cityHint(row: NpItem): string {
  const area = str(row, "Area");
  const region = str(row, "Region");
  const areaLabel = area ? `${area} обл.` : "";
  const regionLabel = region ? `${region} р-н` : "";
  return [regionLabel, areaLabel].filter(Boolean).join(", ");
}

/**
 * Search settlements across the whole country in one step.
 * `searchSettlements` only returns places that Nova Poshta actually serves.
 */
export async function searchCities(query: string): Promise<NpCity[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const key = `cities:${q.toLowerCase()}`;
  const hit = cached<NpCity[]>(key);
  if (hit) return hit;

  const payload = await call("AddressGeneral", "searchSettlements", {
    CityName: q,
    Limit: "50",
    Page: "1",
  });

  const rows = (payload.data?.[0]?.["Addresses"] ?? []) as NpItem[];
  const seen = new Set<string>();
  const out: NpCity[] = [];
  for (const row of rows) {
    const ref = str(row, "Ref");
    const main = str(row, "MainDescription");
    if (!ref || !main || seen.has(ref)) continue;
    seen.add(ref);
    const type = str(row, "SettlementTypeCode");
    const warehouses = Number(row["Warehouses"] ?? 0) || 0;
    out.push({
      ref,
      name: type ? `${type} ${main}` : main,
      hint: cityHint(row),
      warehouses,
    });
  }
  // Bigger hubs first, then alphabetically — matches what people expect.
  out.sort((a, b) => b.warehouses - a.warehouses || a.name.localeCompare(b.name, "uk"));
  store(key, out);
  return out;
}

function kindOf(row: NpItem): NpPointKind {
  const category = str(row, "CategoryOfWarehouse");
  if (category === "Postomat") return "postomat";
  if (category === "DropOff") return "dropoff";
  return "branch";
}

function pointLabel(row: NpItem, kind: NpPointKind): { name: string; address: string } {
  const description = str(row, "Description");
  const number = str(row, "Number");
  const split = description.indexOf(":");
  const address = split > -1 ? description.slice(split + 1).trim() : description;
  const prefix =
    kind === "postomat" ? "Поштомат" : kind === "dropoff" ? "Пункт приймання" : "Відділення";
  return { name: number ? `${prefix} №${number}` : prefix, address };
}

/** Every Nova Poshta point of a settlement: branches, postomats and drop-off points. */
export async function listWarehouses(settlementRef: string): Promise<NpPoint[]> {
  const key = `wh:${settlementRef}`;
  const hit = cached<NpPoint[]>(key);
  if (hit) return hit;

  const PAGE = 500;
  const first = await call("Address", "getWarehouses", {
    SettlementRef: settlementRef,
    Limit: String(PAGE),
    Page: "1",
  });

  const rows: NpItem[] = [...(first.data ?? [])];
  const total = Number(first.info?.totalCount ?? rows.length) || rows.length;
  const pages = Math.min(Math.ceil(total / PAGE), 8);
  if (pages > 1) {
    const rest = await Promise.all(
      Array.from({ length: pages - 1 }, (_, i) =>
        call("Address", "getWarehouses", {
          SettlementRef: settlementRef,
          Limit: String(PAGE),
          Page: String(i + 2),
        }).then((p) => p.data ?? []),
      ),
    );
    for (const chunk of rest) rows.push(...chunk);
  }

  const seen = new Set<string>();
  const out: NpPoint[] = [];
  for (const row of rows) {
    const ref = str(row, "Ref");
    if (!ref || seen.has(ref)) continue;
    // Temporarily closed points must not be selectable.
    if (str(row, "WarehouseStatus") === "Closed") continue;
    seen.add(ref);
    const kind = kindOf(row);
    const { name, address } = pointLabel(row, kind);
    out.push({ ref, name, number: str(row, "Number"), address, kind });
  }

  const rank: Record<NpPointKind, number> = { branch: 0, postomat: 1, dropoff: 2 };
  out.sort(
    (a, b) =>
      rank[a.kind] - rank[b.kind] ||
      (Number(a.number) || 99999) - (Number(b.number) || 99999),
  );
  store(key, out);
  return out;
}
