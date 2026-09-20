// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockUSDG
 * @notice A stand-in loan asset for the Kerb credit demonstration on X Layer testnet.
 *
 * Kerb would rather use the real Paxos testnet USDG at 0xF0863D7A29a55d0c4263c11bFac754312ff078DF.
 * That contract is live on X Layer testnet and its `mint` is permissioned: calling it from an
 * unauthorised address reverts, and the token exposes no faucet, drip or claim. With no way to
 * obtain it, the honest move is a clearly labelled substitute rather than a silent one.
 *
 * The real mainnet USDG address stays wired into the mainnet configuration. This token is for
 * the testnet credit plane only, and its name says so.
 */
contract MockUSDG is ERC20 {
    string public constant DISCLAIMER = "Mock loan asset, testnet only, not USDG and not redeemable";

    /// @notice The real testnet USDG this stands in for, recorded so the substitution is visible.
    address public constant STANDS_IN_FOR = 0xF0863D7A29a55d0c4263c11bFac754312ff078DF;

    uint256 public immutable faucetCap;
    mapping(address => uint256) public minted;

    event Faucet(address indexed to, uint256 amount, uint256 mintedTotal);
    event MockDeployed(string disclaimer, address standsInFor, uint256 faucetCap);

    error FaucetCapExceeded(uint256 requested, uint256 remaining);
    error ZeroAmount();

    constructor(uint256 faucetCap_) ERC20("MOCK TESTNET USDG (not USDG)", "mUSDG") {
        faucetCap = faucetCap_;
        emit MockDeployed(DISCLAIMER, STANDS_IN_FOR, faucetCap_);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function faucet(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        uint256 already = minted[msg.sender];
        if (already + amount > faucetCap) revert FaucetCapExceeded(amount, faucetCap - already);
        minted[msg.sender] = already + amount;
        _mint(msg.sender, amount);
        emit Faucet(msg.sender, amount, already + amount);
    }
}
