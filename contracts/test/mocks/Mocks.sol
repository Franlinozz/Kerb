// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IKerbTerms} from "../../src/interfaces/IKerb.sol";

/// @dev A plain test token with configurable decimals.
contract MockERC20 is ERC20 {
    uint8 private immutable _decimals;

    constructor(string memory n, string memory s, uint8 d) ERC20(n, s) {
        _decimals = d;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @dev A wrapper whose exchange rate the test can move, to prove the rate is never used as a price.
contract MockWrapper {
    uint256 public assetsPerUnit;
    uint256 public immutable unit;

    constructor(uint8 decimals_, uint256 assetsPerUnit_) {
        unit = 10 ** decimals_;
        assetsPerUnit = assetsPerUnit_;
    }

    function setAssetsPerUnit(uint256 v) external {
        assetsPerUnit = v;
    }

    function convertToAssets(uint256 shares) external view returns (uint256) {
        return (shares * assetsPerUnit) / unit;
    }
}

/// @dev A stand-in for KerbTerms whose reports the test drives directly.
contract MockTerms {
    mapping(bytes32 => IKerbTerms.Terms) internal _latest;
    mapping(bytes32 => IKerbTerms.Guardrails) internal _rails;
    mapping(bytes32 => bool) public forcedUnusable;

    function set(bytes32 assetId, IKerbTerms.Terms memory t) external {
        _latest[assetId] = t;
    }

    function setRails(bytes32 assetId, IKerbTerms.Guardrails memory g) external {
        _rails[assetId] = g;
    }

    function setUnusable(bytes32 assetId, bool v) external {
        forcedUnusable[assetId] = v;
    }

    function setMark(bytes32 assetId, uint128 mark) external {
        _latest[assetId].creditMark = mark;
    }

    function setCarry(bytes32 assetId, uint64 carry) external {
        _latest[assetId].carryLTV = carry;
    }

    function latest(bytes32 assetId) external view returns (IKerbTerms.Terms memory) {
        return _latest[assetId];
    }

    function guardrails(bytes32 assetId) external view returns (IKerbTerms.Guardrails memory) {
        return _rails[assetId];
    }

    function effectiveTerms(bytes32 assetId)
        external
        view
        returns (uint64 carryLTV, uint64 sessionMaxLTV, uint128 creditMark, uint16 regime, bool usable)
    {
        IKerbTerms.Terms memory t = _latest[assetId];
        bool sound = t.regime != 7 && t.regime != 6 && !forcedUnusable[assetId];
        return (t.carryLTV, t.sessionMaxLTV, t.creditMark, t.regime, sound && t.observedAt != 0);
    }
}

/// @dev A clock the test opens and closes by hand.
contract MockClock {
    bool public open;
    uint64 public closesAt;
    uint64 public weakensAt;

    function setWindow(bool open_, uint64 closesAt_) external {
        open = open_;
        closesAt = closesAt_;
    }

    function setWeakening(uint64 at) external {
        weakensAt = at;
    }

    function cureWindowOpen(bytes32, uint64) external view returns (bool, uint64) {
        return (open, closesAt);
    }

    function nextWeakening(bytes32, uint64) external view returns (uint8, uint64) {
        return (2, weakensAt);
    }
}

/// @dev Attempts to re-enter borrow during a token transfer.
contract ReentrantToken is ERC20 {
    address public target;
    bytes public payload;
    bool public armed;

    constructor() ERC20("Reentrant", "RE") {}

    function arm(address target_, bytes calldata payload_) external {
        target = target_;
        payload = payload_;
        armed = true;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function decimals() public pure override returns (uint8) {
        return 18;
    }

    function convertToAssets(uint256 shares) external pure returns (uint256) {
        return shares;
    }

    function _update(address from, address to, uint256 value) internal override {
        super._update(from, to, value);
        if (armed && target != address(0)) {
            armed = false;
            (bool ok, bytes memory ret) = target.call(payload);
            if (!ok) {
                assembly {
                    revert(add(ret, 32), mload(ret))
                }
            }
        }
    }
}
