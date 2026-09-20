// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title KerbMirror
 * @notice Test collateral for the Kerb credit demonstration on X Layer testnet.
 *
 * A mirror token has NO economic claim on any security, any issuer, or anything else. It exists
 * so the credit lifecycle can be demonstrated honestly against real risk data without the
 * operator acquiring a restricted tokenized asset. Its price comes from the real mainnet Credit
 * Mark for the asset it mirrors, relayed into the testnet KerbTerms by the attester.
 *
 * The name and the symbol say so, because a screenshot of this token must never be mistaken for
 * the real thing.
 */
contract KerbMirror is ERC20 {
    /// @notice The asset this token mirrors, for display only. It confers nothing.
    string public mirrors;

    /// @notice Maximum any one address may ever mint from the faucet.
    uint256 public immutable faucetCap;

    string public constant DISCLAIMER = "Mirror asset, testnet only, no claim on any security";

    mapping(address => uint256) public minted;

    event Faucet(address indexed to, uint256 amount, uint256 mintedTotal);
    event MirrorDeployed(string mirrors, string disclaimer, uint256 faucetCap);

    error FaucetCapExceeded(uint256 requested, uint256 remaining);
    error ZeroAmount();

    constructor(string memory mirrors_, string memory symbol_, uint256 faucetCap_)
        ERC20(string.concat("MIRROR TESTNET ", mirrors_), string.concat("k", symbol_))
    {
        mirrors = mirrors_;
        faucetCap = faucetCap_;
        emit MirrorDeployed(mirrors_, DISCLAIMER, faucetCap_);
    }

    /// @notice Mint test collateral, up to the per-address cap. Permissionless by design.
    function faucet(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        uint256 already = minted[msg.sender];
        if (already + amount > faucetCap) revert FaucetCapExceeded(amount, faucetCap - already);
        minted[msg.sender] = already + amount;
        _mint(msg.sender, amount);
        emit Faucet(msg.sender, amount, already + amount);
    }

    /// @dev The wrapper surface KerbCredit values collateral through. A mirror has no wrapper
    ///      above it, so a share is one unit of the underlying: 1:1, and stated explicitly
    ///      rather than left for a caller to assume.
    function convertToAssets(uint256 shares) external pure returns (uint256) {
        return shares;
    }
}
