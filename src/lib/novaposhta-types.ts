/** Shared Nova Poshta directory types (client-safe, no server imports). */

export type NpCity = {
  /** Settlement Ref used to load warehouses. */
  ref: string;
  /** "м. Харків" */
  name: string;
  /** "Харківська обл." / "Лозівський р-н, Харківська обл." */
  hint: string;
  /** Number of Nova Poshta points in the settlement. */
  warehouses: number;
};

export type NpPointKind = "branch" | "postomat" | "dropoff";

export type NpPoint = {
  ref: string;
  /** Short label: "Відділення №1" / "Поштомат №5432" */
  name: string;
  number: string;
  /** Street address without the settlement prefix. */
  address: string;
  kind: NpPointKind;
};
