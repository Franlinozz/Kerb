/** The slice of KerbCredit, the mirror and the loan asset the market UI actually calls. */
export const CREDIT_ABI = [
  { type: "function", name: "supply", stateMutability: "nonpayable", inputs: [{ name: "assets", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "withdraw", stateMutability: "nonpayable", inputs: [{ name: "shares", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "deposit", stateMutability: "nonpayable", inputs: [{ name: "assetId", type: "bytes32" }, { name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "withdrawCollateral", stateMutability: "nonpayable", inputs: [{ name: "assetId", type: "bytes32" }, { name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "borrow", stateMutability: "nonpayable", inputs: [{ name: "assetId", type: "bytes32" }, { name: "amount", type: "uint256" }, { name: "mode", type: "uint8" }], outputs: [] },
  { type: "function", name: "repay", stateMutability: "nonpayable", inputs: [{ name: "assetId", type: "bytes32" }, { name: "amount", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "cure", stateMutability: "nonpayable", inputs: [{ name: "user", type: "address" }, { name: "assetId", type: "bytes32" }, { name: "repayAmount", type: "uint256" }], outputs: [{ type: "uint256" }, { type: "uint256" }] },
  { type: "function", name: "debtOf", stateMutability: "view", inputs: [{ name: "user", type: "address" }, { name: "assetId", type: "bytes32" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "positionLTV", stateMutability: "view", inputs: [{ name: "user", type: "address" }, { name: "assetId", type: "bytes32" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "healthFactor", stateMutability: "view", inputs: [{ name: "user", type: "address" }, { name: "assetId", type: "bytes32" }], outputs: [{ type: "uint256" }] },
  {
    type: "function", name: "cureStatus", stateMutability: "view",
    inputs: [{ name: "user", type: "address" }, { name: "assetId", type: "bytes32" }],
    outputs: [{ name: "eligible", type: "bool" }, { name: "deadline", type: "uint64" }, { name: "requiredRepay", type: "uint256" }],
  },
  {
    type: "function", name: "position", stateMutability: "view",
    inputs: [{ name: "user", type: "address" }, { name: "assetId", type: "bytes32" }],
    outputs: [{
      type: "tuple", components: [
        { name: "collateralShares", type: "uint128" }, { name: "debtShares", type: "uint128" },
        { name: "carryTarget", type: "uint64" }, { name: "mode", type: "uint8" }, { name: "lastCureAt", type: "uint64" },
      ],
    }],
  },
] as const;

export const ERC20_ABI = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "o", type: "address" }, { name: "s", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "s", type: "address" }, { name: "v", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "faucet", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "minted", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "faucetCap", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;
