/** Every custom error KerbCredit, KerbMirror and MockUSDG can revert with, so viem can decode them. */
export const KERB_ERRORS_ABI = [
  { type: "error", name: "NotAdmin", inputs: [] },
  { type: "error", name: "NotGuardian", inputs: [] },
  { type: "error", name: "ZeroAddress", inputs: [] },
  { type: "error", name: "ZeroAmount", inputs: [] },
  { type: "error", name: "UnknownCollateral", inputs: [{ name: "assetId", type: "bytes32" }] },
  { type: "error", name: "AlreadyListed", inputs: [{ name: "assetId", type: "bytes32" }] },
  { type: "error", name: "BorrowPaused", inputs: [] },
  { type: "error", name: "DepositPaused", inputs: [] },
  { type: "error", name: "TermsUnusable", inputs: [{ name: "assetId", type: "bytes32" }, { name: "regime", type: "uint16" }] },
  { type: "error", name: "BadMode", inputs: [{ name: "mode", type: "uint8" }] },
  { type: "error", name: "ExceedsModeLTV", inputs: [{ name: "ltv", type: "uint256" }, { name: "ceiling", type: "uint256" }] },
  { type: "error", name: "ExceedsDebtCeiling", inputs: [{ name: "assetDebt", type: "uint256" }, { name: "ceiling", type: "uint256" }] },
  { type: "error", name: "ExceedsPositionCap", inputs: [{ name: "positionDebt", type: "uint256" }, { name: "cap", type: "uint256" }] },
  { type: "error", name: "InsufficientLiquidity", inputs: [{ name: "requested", type: "uint256" }, { name: "available", type: "uint256" }] },
  { type: "error", name: "PositionUnsafe", inputs: [{ name: "healthFactor", type: "uint256" }] },
  { type: "error", name: "NoDebt", inputs: [] },
  { type: "error", name: "CureWindowClosed", inputs: [{ name: "assetId", type: "bytes32" }] },
  { type: "error", name: "NotCurable", inputs: [{ name: "ltv", type: "uint256" }, { name: "target", type: "uint256" }] },
  { type: "error", name: "CureTooLarge", inputs: [{ name: "requested", type: "uint256" }, { name: "allowed", type: "uint256" }] },
  { type: "error", name: "NotLiquidatable", inputs: [{ name: "healthFactor", type: "uint256" }] },
  { type: "error", name: "CloseFactorExceeded", inputs: [{ name: "requested", type: "uint256" }, { name: "allowed", type: "uint256" }] },
  { type: "error", name: "InsufficientCollateral", inputs: [{ name: "needed", type: "uint256" }, { name: "held", type: "uint256" }] },
  { type: "error", name: "MarkUnavailable", inputs: [{ name: "assetId", type: "bytes32" }] },
  { type: "error", name: "MathOverflow", inputs: [] },
  { type: "error", name: "FaucetCapExceeded", inputs: [{ name: "requested", type: "uint256" }, { name: "remaining", type: "uint256" }] },
] as const;

/** The slice of KerbCredit, the mirror and the loan asset the market UI actually calls. */
export const CREDIT_ABI = [
  { type: "function", name: "supply", stateMutability: "nonpayable", inputs: [{ name: "assets", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "withdraw", stateMutability: "nonpayable", inputs: [{ name: "shares", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "deposit", stateMutability: "nonpayable", inputs: [{ name: "assetId", type: "bytes32" }, { name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "withdrawCollateral", stateMutability: "nonpayable", inputs: [{ name: "assetId", type: "bytes32" }, { name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "borrow", stateMutability: "nonpayable", inputs: [{ name: "assetId", type: "bytes32" }, { name: "amount", type: "uint256" }, { name: "mode", type: "uint8" }], outputs: [] },
  { type: "function", name: "repay", stateMutability: "nonpayable", inputs: [{ name: "assetId", type: "bytes32" }, { name: "amount", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "cure", stateMutability: "nonpayable", inputs: [{ name: "user", type: "address" }, { name: "assetId", type: "bytes32" }, { name: "repayAmount", type: "uint256" }], outputs: [{ type: "uint256" }, { type: "uint256" }] },
  { type: "function", name: "supplyShares", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "suppliedOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
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
  ...KERB_ERRORS_ABI,
] as const;

export const ERC20_ABI = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "o", type: "address" }, { name: "s", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "s", type: "address" }, { name: "v", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "faucet", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "minted", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "faucetCap", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  ...KERB_ERRORS_ABI,
] as const;
