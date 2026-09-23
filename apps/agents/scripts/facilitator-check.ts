/** Checks the facilitator credentials: prints the kinds OKX supports for them, or the refusal. No secret is printed. */
import { okxFacilitator } from "../src/pay.js";
try {
  const s = await okxFacilitator().getSupported();
  console.log(JSON.stringify(s.kinds));
} catch (e) {
  console.log("facilitator refused:", e instanceof Error ? e.message.slice(0, 300) : String(e));
}
