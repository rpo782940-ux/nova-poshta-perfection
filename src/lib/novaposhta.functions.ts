import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Official Nova Poshta API v2.0 proxy (address directories).
 * Runs only on the server. The optional NOVAPOSHTA_API_KEY secret is used when
 * present; the public address directories stay available even without it, so
 * the picker never falls back to manual input.
 *
 * Flow follows the official directory hierarchy:
 *   region (getSettlementAreas) -> settlement (getSettlements, Warehouse=1)
 *   -> warehouse / postomat (getWarehouses) or street (searchSettlementStreets)
 */
const ENDPOINT = "https://api.novaposhta.ua/v2.0/json/";

type NpItem = Record<string, unknown>;

async function request(
  apiKey: string,
  modelName: string,
  calledMethod: string,
  methodProperties: Record<string, unknown>,
) {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey, modelName, calledMethod, methodProperties }),
  });
  if (!response.ok) throw new Error(`novaposhta_http_${response.status}`);
  return (await response.json()) as { success: boolean; data?: NpItem[]; errors?: string[] };
}

async function callNovaPoshta(
  modelName: string,
  calledMethod: string,
  methodProperties: Record<string, unknown>,
): Promise<NpItem[]> {
  const key = process.env["NOVAPOSHTA_API_KEY"] ?? "";
  let payload = await request(key, modelName, calledMethod, methodProperties);

  // A missing/expired counterparty key must never break the address directories.
  if (!payload.success && key) {
    payload = await request("", modelName, calledMethod, methodProperties);
  }
  if (!payload.success) throw new Error(payload.errors?.join("; ") || "novaposhta_error");
  return payload.data ?? [];
}

const str = (value: unknown) => (typeof value === "string" ? value : "");

const pick = (row: NpItem, field: string, lang: "ru" | "uk") => {
  const ru = str(row[`${field}Ru`]);
  const ua = str(row[field]);
  return lang === "ru" ? ru || ua : ua || ru;
};

const langSchema = z.enum(["ru", "uk"]).default("uk");

export type NpOption = { ref: string; name: string; hint?: string };
export type NpPoint = { ref: string; name: string; number: string; postomat: boolean };

/** Regions (oblasts) that Nova Poshta actually serves. */
export const npAreas = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ lang: langSchema }).parse(data ?? {}))
  .handler(async ({ data }): Promise<NpOption[]> => {
    const rows = await callNovaPoshta("AddressGeneral", "getSettlementAreas", {});
    const suffix = data.lang === "ru" ? " область" : " область";
    return rows
      .map((a) => {
        const base = pick(a, "Description", data.lang);
        return { ref: str(a["Ref"]), name: base ? `${base}${suffix}` : "" };
      })
      // Crimea is not served by Nova Poshta — it must not be selectable.
      .filter((a) => a.ref && a.name && !/АРК|Крим|Крым/i.test(a.name))
      .sort((a, b) => a.name.localeCompare(b.name, "uk"));
  });

/** Settlements of a region that have at least one Nova Poshta point. */
export const npCities = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        areaRef: z.string().min(1).max(64),
        search: z.string().max(80).default(""),
        lang: langSchema,
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<NpOption[]> => {
    const search = data.search.trim();
    const props: Record<string, unknown> = {
      AreaRef: data.areaRef,
      Warehouse: "1",
      Limit: "150",
      Page: "1",
    };
    if (search.length >= 2) props["FindByString"] = search;

    const out: NpOption[] = [];
    for (let page = 1; page <= 6; page++) {
      props["Page"] = String(page);
      const rows = await callNovaPoshta("AddressGeneral", "getSettlements", props);
      for (const c of rows) {
        const ref = str(c["Ref"]);
        const name = pick(c, "Description", data.lang);
        if (!ref || !name) continue;
        const type = pick(c, "SettlementTypeDescription", data.lang);
        const region = pick(c, "RegionsDescription", data.lang);
        out.push({
          ref,
          name: type ? `${shortType(type)} ${name}` : name,
          hint: region ? `${region}${/р-н|район/i.test(region) ? "" : " р-н"}` : "",
        });
      }
      if (rows.length < 150) break;
      if (search.length >= 2) break;
    }
    return out;
  });

/** Official abbreviations for settlement types. */
function shortType(type: string): string {
  const map: Record<string, string> = {
    місто: "м.",
    город: "г.",
    село: "с.",
    селище: "с-ще",
    "селище міського типу": "смт",
    "поселок городского типа": "пгт",
    поселок: "пос.",
    "селище міського типу (смт)": "смт",
  };
  return map[type.toLowerCase()] ?? type;
}

/** Branches, cargo departments and postomats of a settlement. */
export const npWarehouses = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        settlementRef: z.string().min(1).max(64),
        search: z.string().max(80).default(""),
        postomat: z.boolean().default(false),
        lang: langSchema,
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<NpPoint[]> => {
    const search = data.search.trim();
    const props: Record<string, unknown> = {
      SettlementRef: data.settlementRef,
      Limit: "100",
      Page: "1",
    };
    if (data.postomat) props["CategoryOfWarehouse"] = "Postomat";
    if (search.length >= 1) props["FindByString"] = search;

    const rows = await callNovaPoshta("Address", "getWarehouses", props);
    const out: NpPoint[] = [];
    for (const w of rows) {
      const ref = str(w["Ref"]);
      const name = pick(w, "Description", data.lang);
      if (!ref || !name) continue;
      const postomat = str(w["CategoryOfWarehouse"]) === "Postomat";
      if (postomat !== data.postomat) continue;
      out.push({ ref, name, number: str(w["Number"]), postomat });
    }
    return out.sort((a, b) => (Number(a.number) || 9999) - (Number(b.number) || 9999));
  });

/** Street directory of a settlement, for courier delivery to an address. */
export const npStreets = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        settlementRef: z.string().min(1).max(64),
        search: z.string().max(80),
        lang: langSchema,
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<NpOption[]> => {
    const search = data.search.trim();
    if (search.length < 2) return [];
    const rows = await callNovaPoshta("Address", "searchSettlementStreets", {
      SettlementRef: data.settlementRef,
      StreetName: search,
      Limit: "50",
    });
    const addresses = (rows[0]?.["Addresses"] ?? []) as NpItem[];
    return addresses
      .map((s) => {
        const type = str(s["StreetsTypeDescription"]);
        const name = pick(s, "SettlementStreetDescription", data.lang);
        return { ref: str(s["SettlementStreetRef"]), name: [type, name].filter(Boolean).join(" ") };
      })
      .filter((s) => s.ref && s.name);
  });
