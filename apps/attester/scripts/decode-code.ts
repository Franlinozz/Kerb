/** Decode the Builder Code carried by a transaction's calldata, straight from the chain. */
import { publicClient, type KerbChainId } from "@kerb/adapters";
import { decodeBuilderCode } from "../src/builder-code.js";
import type { Hex } from "viem";

const chainId = Number(process.argv[2]) as KerbChainId;
const hash = process.argv[3] as Hex;
if (!chainId || !hash) throw new Error("usage: decode-code <chainId> <txHash>");
const tx = await publicClient(chainId).getTransaction({ hash });
const codes = decodeBuilderCode(tx.input);
console.log(`tx    ${hash}`);
console.log(`to    ${tx.to ?? "(contract creation)"}`);
console.log(`bytes ${(tx.input.length - 2) / 2}`);
console.log(`codes ${codes.length ? codes.join(", ") : "(none)"}`);
console.log(`tail  ${tx.input.slice(-44)}`);
