import { runMasteraFormSync } from "../src/lib/masteraform-sync.server";
const r = await runMasteraFormSync("manual");
console.log("RESULT", JSON.stringify(r));
