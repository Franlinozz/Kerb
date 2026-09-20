// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IKerbClock, IKerbTerms, IWrapper} from "./interfaces/IKerb.sol";

/**
 * @title KerbCredit
 * @notice An isolated lending market for one loan asset against whitelisted tokenized-equity
 *         collateral, priced by the Kerb Credit Mark and governed by market time.
 *
 * The promise this contract exists to keep: never lend more than you can liquidate.
 *
 * Two things make it different from an ordinary LTV market:
 *
 *  1. The liquidation threshold never moves. Sessions move borrowing capacity and the cure
 *     covenant only. A borrower's liquidation line is fixed at draw time and can only be changed
 *     by a timelocked admin, never by a report and never by the passage of time.
 *
 *  2. A position drawn above the Carry ceiling carries a covenant. When the underlying market is
 *     about to weaken, the Last Call window opens and anyone may Cure the position: repay exactly
 *     the amount needed to bring it back to its Carry target, for a small bonus. Cure is not
 *     liquidation. It cannot seize more than the covenant requires and it cannot run outside the
 *     window.
 *
 * Rounding always favours the protocol, never the user: debt rounds up, collateral credit rounds
 * down. Repay, cure, liquidate and withdrawing collateral to safety are never pausable.
 */
contract KerbCredit is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ---------------------------------------------------------------- types

    struct Position {
        uint128 collateralShares;
        uint128 debtShares;
        /// @dev carryLTV recorded at the most recent draw: the covenant target.
        uint64 carryTarget;
        /// @dev 0 = Carry, 1 = Session Max.
        uint8 mode;
        uint64 lastCureAt;
    }

    struct CollateralConfig {
        IERC20 token;
        /// @dev The ERC-4626-style wrapper the collateral is valued through. Zero means the token
        ///      is its own wrapper at 1:1, which is how mirror collateral behaves on testnet.
        IWrapper wrapper;
        uint8 tokenDecimals;
        /// @dev Fixed liquidation threshold, 1e18. Never moved by a report.
        uint64 liquidationThreshold;
        /// @dev Share of debt a single liquidation may close, 1e18.
        uint64 closeFactor;
        uint64 cureBonus; // 1e18
        uint64 defaultBonus; // 1e18
        bool listed;
    }

    // ---------------------------------------------------------------- constants

    uint256 internal constant WAD = 1e18;
    /// @dev KTS-0.1 section 4.1 ordering.
    uint16 internal constant REGIME_HALTED = 6;
    uint16 internal constant REGIME_STALE = 7;
    uint256 internal constant SECONDS_PER_YEAR = 365 days;
    /// @dev Virtual shares and assets, so the first depositor cannot skew the exchange rate.
    uint256 internal constant VIRTUAL = 1e6;

    // ---------------------------------------------------------------- immutables

    IERC20 public immutable loanAsset;
    uint8 public immutable loanDecimals;
    IKerbTerms public immutable terms;
    IKerbClock public immutable clock;

    // ---------------------------------------------------------------- interest model

    /// @dev Two-slope kink model, all 1e18 per year.
    uint256 public immutable baseRate;
    uint256 public immutable slope1;
    uint256 public immutable slope2;
    uint256 public immutable kink;
    uint256 public immutable reserveFactor;

    // ---------------------------------------------------------------- storage

    address public admin;
    address public guardian;
    address public reserveRecipient;

    bool public borrowPaused;
    bool public depositPaused;

    uint256 public totalSuppliedAssets;
    uint256 public totalSupplyShares;
    uint256 public totalDebtAssets;
    uint256 public totalDebtShares;
    uint256 public reserves;
    uint64 public lastAccrualAt;

    mapping(address => uint256) public supplyShares;
    mapping(bytes32 => CollateralConfig) internal _collateral;
    mapping(bytes32 => uint256) public assetDebtShares;
    mapping(address => mapping(bytes32 => Position)) internal _positions;

    // ---------------------------------------------------------------- events

    event Supplied(address indexed user, uint256 assets, uint256 shares);
    event Withdrawn(address indexed user, uint256 assets, uint256 shares);
    event CollateralDeposited(address indexed user, bytes32 indexed assetId, uint256 amount);
    event CollateralWithdrawn(address indexed user, bytes32 indexed assetId, uint256 amount);
    event Borrowed(address indexed user, bytes32 indexed assetId, uint256 amount, uint8 mode, uint64 carryTarget);
    event Repaid(address indexed payer, address indexed user, bytes32 indexed assetId, uint256 amount, uint256 shares);
    event Cured(
        address indexed curer, address indexed user, bytes32 indexed assetId, uint256 repaid, uint256 seized, uint64 target
    );
    event Liquidated(
        address indexed liquidator, address indexed user, bytes32 indexed assetId, uint256 repaid, uint256 seized
    );
    event Accrued(uint256 interest, uint256 toReserves, uint256 totalDebtAssets);
    event CollateralListed(bytes32 indexed assetId, CollateralConfig config);
    event PausedSet(bool borrowPaused, bool depositPaused);
    event AdminSet(address indexed admin);
    event GuardianSet(address indexed guardian);
    event ReserveRecipientSet(address indexed recipient);
    event ReservesWithdrawn(address indexed to, uint256 amount);

    // ---------------------------------------------------------------- errors

    error NotAdmin();
    error NotGuardian();
    error ZeroAddress();
    error ZeroAmount();
    error UnknownCollateral(bytes32 assetId);
    error AlreadyListed(bytes32 assetId);
    error BorrowPaused();
    error DepositPaused();
    error TermsUnusable(bytes32 assetId, uint16 regime);
    error BadMode(uint8 mode);
    error ExceedsModeLTV(uint256 ltv, uint256 ceiling);
    error ExceedsDebtCeiling(uint256 assetDebt, uint256 ceiling);
    error ExceedsPositionCap(uint256 positionDebt, uint256 cap);
    error InsufficientLiquidity(uint256 requested, uint256 available);
    error PositionUnsafe(uint256 healthFactor);
    error NoDebt();
    error CureWindowClosed(bytes32 assetId);
    error NotCurable(uint256 ltv, uint256 target);
    error CureTooLarge(uint256 requested, uint256 allowed);
    error NotLiquidatable(uint256 healthFactor);
    error CloseFactorExceeded(uint256 requested, uint256 allowed);
    error InsufficientCollateral(uint256 needed, uint256 held);
    error MarkUnavailable(bytes32 assetId);

    // ---------------------------------------------------------------- modifiers

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    modifier onlyGuardian() {
        if (msg.sender != guardian && msg.sender != admin) revert NotGuardian();
        _;
    }

    /// @dev Interest is brought up to date before anything reads or writes a balance.
    modifier accrues() {
        _accrue();
        _;
    }

    constructor(
        IERC20 loanAsset_,
        uint8 loanDecimals_,
        IKerbTerms terms_,
        IKerbClock clock_,
        address admin_,
        address guardian_,
        address reserveRecipient_,
        uint256[5] memory rateModel // baseRate, slope1, slope2, kink, reserveFactor
    ) {
        if (
            address(loanAsset_) == address(0) || address(terms_) == address(0) || address(clock_) == address(0)
                || admin_ == address(0) || guardian_ == address(0) || reserveRecipient_ == address(0)
        ) revert ZeroAddress();
        loanAsset = loanAsset_;
        loanDecimals = loanDecimals_;
        terms = terms_;
        clock = clock_;
        admin = admin_;
        guardian = guardian_;
        reserveRecipient = reserveRecipient_;
        baseRate = rateModel[0];
        slope1 = rateModel[1];
        slope2 = rateModel[2];
        kink = rateModel[3];
        reserveFactor = rateModel[4];
        lastAccrualAt = uint64(block.timestamp);
        emit AdminSet(admin_);
        emit GuardianSet(guardian_);
        emit ReserveRecipientSet(reserveRecipient_);
    }

    // ================================================================ admin

    function setAdmin(address a) external onlyAdmin {
        if (a == address(0)) revert ZeroAddress();
        admin = a;
        emit AdminSet(a);
    }

    function setGuardian(address g) external onlyAdmin {
        if (g == address(0)) revert ZeroAddress();
        guardian = g;
        emit GuardianSet(g);
    }

    function setReserveRecipient(address r) external onlyAdmin {
        if (r == address(0)) revert ZeroAddress();
        reserveRecipient = r;
        emit ReserveRecipientSet(r);
    }

    /**
     * @notice List a collateral asset. The liquidation threshold is fixed here and nowhere else:
     *         no report, no session and no passage of time can move it.
     * @dev Listing is one-shot per asset. Changing a live market's threshold under borrowers is
     *      exactly the move this protocol exists to avoid, so there is no setter.
     */
    function listCollateral(bytes32 assetId, CollateralConfig calldata c) external onlyAdmin {
        if (_collateral[assetId].listed) revert AlreadyListed(assetId);
        if (address(c.token) == address(0)) revert ZeroAddress();
        if (c.liquidationThreshold == 0 || c.liquidationThreshold >= WAD) revert ExceedsModeLTV(c.liquidationThreshold, WAD);
        if (c.closeFactor == 0 || c.closeFactor > WAD) revert CloseFactorExceeded(c.closeFactor, WAD);
        CollateralConfig memory cfg = c;
        cfg.listed = true;
        _collateral[assetId] = cfg;
        emit CollateralListed(assetId, cfg);
    }

    /// @notice The guardian may stop new risk. It may never stop a user reducing risk.
    function setPaused(bool borrowPaused_, bool depositPaused_) external onlyGuardian {
        borrowPaused = borrowPaused_;
        depositPaused = depositPaused_;
        emit PausedSet(borrowPaused_, depositPaused_);
    }

    function withdrawReserves(address to, uint256 amount) external onlyAdmin accrues nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (amount > reserves) revert InsufficientLiquidity(amount, reserves);
        reserves -= amount;
        loanAsset.safeTransfer(to, amount);
        emit ReservesWithdrawn(to, amount);
    }

    // ================================================================ interest

    /// @notice Utilisation of the pool, 1e18.
    function utilisation() public view returns (uint256) {
        uint256 supplied = totalSuppliedAssets;
        if (supplied == 0) return 0;
        return Math.mulDivDown(totalDebtAssets, WAD, supplied);
    }

    /// @notice Current borrow rate per year, 1e18, from the two-slope kink model.
    function borrowRate() public view returns (uint256) {
        uint256 u = utilisation();
        if (u <= kink) {
            return baseRate + (kink == 0 ? 0 : Math.mulDivDown(slope1, u, kink));
        }
        uint256 excess = u - kink;
        uint256 span = WAD - kink;
        return baseRate + slope1 + (span == 0 ? 0 : Math.mulDivDown(slope2, excess, span));
    }

    /**
     * @dev Interest is a pure function of elapsed time, so it is monotonic and cannot be changed
     *      by calling more often within a block. Debt rounds up, which favours the protocol.
     */
    function _accrue() internal {
        uint64 nowTs = uint64(block.timestamp);
        uint256 elapsed = nowTs - lastAccrualAt;
        if (elapsed == 0) return;
        lastAccrualAt = nowTs;
        uint256 debt = totalDebtAssets;
        if (debt == 0) return;

        uint256 interest = Math.mulDivUp(debt, borrowRate() * elapsed, SECONDS_PER_YEAR * WAD);
        if (interest == 0) return;
        uint256 toReserves = Math.mulDivDown(interest, reserveFactor, WAD);
        totalDebtAssets = debt + interest;
        totalSuppliedAssets += interest - toReserves;
        reserves += toReserves;
        emit Accrued(interest, toReserves, totalDebtAssets);
    }

    function accrue() external {
        _accrue();
    }

    // ================================================================ supply side

    function supply(uint256 assets) external accrues nonReentrant returns (uint256 shares) {
        if (assets == 0) revert ZeroAmount();
        // Shares round down: a supplier never gets more claim than they paid for.
        shares = Math.mulDivDown(assets, totalSupplyShares + VIRTUAL, totalSuppliedAssets + VIRTUAL);
        if (shares == 0) revert ZeroAmount();
        totalSupplyShares += shares;
        totalSuppliedAssets += assets;
        supplyShares[msg.sender] += shares;
        loanAsset.safeTransferFrom(msg.sender, address(this), assets);
        emit Supplied(msg.sender, assets, shares);
    }

    function withdraw(uint256 shares) external accrues nonReentrant returns (uint256 assets) {
        if (shares == 0) revert ZeroAmount();
        // Assets round down: the pool never pays out more than the share is worth.
        assets = Math.mulDivDown(shares, totalSuppliedAssets + VIRTUAL, totalSupplyShares + VIRTUAL);
        uint256 available = totalSuppliedAssets - totalDebtAssets;
        if (assets > available) revert InsufficientLiquidity(assets, available);
        supplyShares[msg.sender] -= shares;
        totalSupplyShares -= shares;
        totalSuppliedAssets -= assets;
        loanAsset.safeTransfer(msg.sender, assets);
        emit Withdrawn(msg.sender, assets, shares);
    }

    // ================================================================ collateral

    function deposit(bytes32 assetId, uint256 amount) external accrues nonReentrant {
        if (depositPaused) revert DepositPaused();
        CollateralConfig memory c = _config(assetId);
        if (amount == 0) revert ZeroAmount();
        _positions[msg.sender][assetId].collateralShares += uint128(amount);
        c.token.safeTransferFrom(msg.sender, address(this), amount);
        emit CollateralDeposited(msg.sender, assetId, amount);
    }

    /**
     * @notice Withdraw collateral. Never pausable: a user reducing their exposure must always be
     *         able to act, including while the market is paused or the terms are stale.
     */
    function withdrawCollateral(bytes32 assetId, uint256 amount) external accrues nonReentrant {
        CollateralConfig memory c = _config(assetId);
        if (amount == 0) revert ZeroAmount();
        Position storage p = _positions[msg.sender][assetId];
        if (amount > p.collateralShares) revert InsufficientCollateral(amount, p.collateralShares);
        p.collateralShares -= uint128(amount);

        // A position with debt must still be safe at the fixed threshold afterwards. With no debt
        // there is nothing to be unsafe about, so a stale mark must not trap the collateral.
        if (p.debtShares != 0) {
            uint256 hf = _healthFactor(msg.sender, assetId, c);
            if (hf < WAD) revert PositionUnsafe(hf);
        }
        c.token.safeTransfer(msg.sender, amount);
        emit CollateralWithdrawn(msg.sender, assetId, amount);
    }

    // ================================================================ borrow and repay

    /**
     * @notice Draw credit against a collateral position.
     * @param mode 0 = Carry, held through the next weakening. 1 = Session Max, available only
     *        while the session holds and only with the cure covenant attached.
     * @dev The ceiling is enforced at the same mark used in this transaction, and the Carry
     *      target is recorded now so a later loosening cannot retroactively excuse the position.
     */
    function borrow(bytes32 assetId, uint256 amount, uint8 mode) external accrues nonReentrant {
        if (borrowPaused) revert BorrowPaused();
        if (mode > 1) revert BadMode(mode);
        if (amount == 0) revert ZeroAmount();
        CollateralConfig memory c = _config(assetId);

        (uint64 carryLTV, uint64 sessionMaxLTV, uint128 creditMark, uint16 regime, bool usable) =
            terms.effectiveTerms(assetId);
        if (!usable) revert TermsUnusable(assetId, regime);
        if (creditMark == 0) revert MarkUnavailable(assetId);

        uint256 available = totalSuppliedAssets - totalDebtAssets;
        if (amount > available) revert InsufficientLiquidity(amount, available);

        Position storage p = _positions[msg.sender][assetId];
        // Debt shares round up: the borrower owes at least what they took.
        uint256 shares = Math.mulDivUp(amount, totalDebtShares + VIRTUAL, totalDebtAssets + VIRTUAL);
        p.debtShares += uint128(shares);
        totalDebtShares += shares;
        totalDebtAssets += amount;
        assetDebtShares[assetId] += shares;

        uint256 positionDebt = _debtOf(p.debtShares);
        uint256 value = _collateralValue(p.collateralShares, c, creditMark);
        uint256 ltv = value == 0 ? type(uint256).max : Math.mulDivUp(positionDebt, WAD, value);
        uint256 ceiling = mode == 0 ? carryLTV : sessionMaxLTV;
        if (ltv > ceiling) revert ExceedsModeLTV(ltv, ceiling);

        IKerbTerms.Terms memory t = terms.latest(assetId);
        uint256 assetDebt = _debtOf(assetDebtShares[assetId]);
        if (assetDebt > t.debtCeiling) revert ExceedsDebtCeiling(assetDebt, t.debtCeiling);
        if (positionDebt > t.maxPositionDebt) revert ExceedsPositionCap(positionDebt, t.maxPositionDebt);

        // The covenant target is the Carry ceiling as it stood at this draw.
        p.carryTarget = carryLTV;
        p.mode = mode;

        loanAsset.safeTransfer(msg.sender, amount);
        emit Borrowed(msg.sender, assetId, amount, mode, carryLTV);
    }

    /// @notice Repay debt. Never pausable, and never blocked by stale or halted terms.
    function repay(bytes32 assetId, uint256 amount) external accrues nonReentrant returns (uint256 repaid) {
        return _repay(msg.sender, msg.sender, assetId, amount);
    }

    /// @notice Repay on someone else's behalf. Also never pausable.
    function repayFor(address user, bytes32 assetId, uint256 amount)
        external
        accrues
        nonReentrant
        returns (uint256 repaid)
    {
        return _repay(msg.sender, user, assetId, amount);
    }

    function _repay(address payer, address user, bytes32 assetId, uint256 amount) internal returns (uint256 repaid) {
        _config(assetId);
        if (amount == 0) revert ZeroAmount();
        Position storage p = _positions[user][assetId];
        if (p.debtShares == 0) revert NoDebt();

        uint256 debt = _debtOf(p.debtShares);
        repaid = amount > debt ? debt : amount;
        // Shares burned round down, so a repayment never clears more debt than it paid for.
        uint256 shares = Math.mulDivDown(repaid, totalDebtShares + VIRTUAL, totalDebtAssets + VIRTUAL);
        if (shares > p.debtShares) shares = p.debtShares;
        // Clearing the last of the debt must clear the last of the shares.
        if (repaid == debt) shares = p.debtShares;

        p.debtShares -= uint128(shares);
        totalDebtShares -= shares;
        totalDebtAssets -= repaid;
        assetDebtShares[assetId] -= shares;
        if (p.debtShares == 0) {
            p.carryTarget = 0;
            p.mode = 0;
        }

        loanAsset.safeTransferFrom(payer, address(this), repaid);
        emit Repaid(payer, user, assetId, repaid, shares);
    }

    // ================================================================ cure

    /**
     * @notice The covenant. While the Last Call window is open for this asset, anyone may repay
     *         exactly the amount that brings the position back to its Carry target, and is paid
     *         a small bonus in collateral for doing it.
     * @dev This is not liquidation. It cannot run outside the window, it cannot repay more than
     *      the covenant requires, and it stops being available the moment the borrower is at target.
     */
    function cure(address user, bytes32 assetId, uint256 repayAmount)
        external
        accrues
        nonReentrant
        returns (uint256 repaid, uint256 seized)
    {
        CollateralConfig memory c = _config(assetId);
        (bool open,) = clock.cureWindowOpen(assetId, uint64(block.timestamp));
        if (!open) revert CureWindowClosed(assetId);

        (uint256 ltv, uint256 target, uint256 required, uint256 mark) = _cureMath(user, assetId, c);
        if (required == 0) revert NotCurable(ltv, target);
        if (repayAmount == 0) revert ZeroAmount();
        if (repayAmount > required) revert CureTooLarge(repayAmount, required);

        repaid = _repay(msg.sender, user, assetId, repayAmount);
        seized = _seize(user, assetId, c, repaid, c.cureBonus, mark);
        _positions[user][assetId].lastCureAt = uint64(block.timestamp);
        emit Cured(msg.sender, user, assetId, repaid, seized, uint64(target));
    }

    /**
     * @notice What a curer, or the borrower, needs to know before acting.
     * @return eligible Whether a cure may run right now.
     * @return deadline When the Last Call window closes, or the next weakening if it has not opened.
     * @return requiredRepay The exact amount that brings the position to target at the current mark.
     */
    function cureStatus(address user, bytes32 assetId)
        external
        view
        returns (bool eligible, uint64 deadline, uint256 requiredRepay)
    {
        CollateralConfig memory c = _config(assetId);
        (bool open, uint64 closesAt) = clock.cureWindowOpen(assetId, uint64(block.timestamp));
        (,, uint256 required,) = _cureMath(user, assetId, c);
        if (open) {
            deadline = closesAt;
        } else {
            (, uint64 at) = clock.nextWeakening(assetId, uint64(block.timestamp));
            deadline = at;
        }
        return (open && required > 0, deadline, required);
    }

    /**
     * @dev The target is min(carryTarget recorded at the draw, the current Carry ceiling), so
     *      neither a loosening nor a tightening after the fact can be used against the borrower
     *      or by them. Required repayment rounds up, against the borrower.
     */
    function _cureMath(address user, bytes32 assetId, CollateralConfig memory c)
        internal
        view
        returns (uint256 ltv, uint256 target, uint256 required, uint256 mark)
    {
        Position memory p = _positions[user][assetId];
        if (p.debtShares == 0) return (0, 0, 0, 0);

        (uint64 carryLTV,, uint128 creditMark,,) = terms.effectiveTerms(assetId);
        if (creditMark == 0) return (0, 0, 0, 0);
        mark = creditMark;

        target = p.carryTarget == 0 || uint256(carryLTV) < p.carryTarget ? carryLTV : p.carryTarget;
        uint256 value = _collateralValue(p.collateralShares, c, creditMark);
        uint256 debt = _debtOf(p.debtShares);
        if (value == 0) return (type(uint256).max, target, debt, mark);

        ltv = Math.mulDivUp(debt, WAD, value);
        if (ltv <= target) return (ltv, target, 0, mark);

        uint256 allowedDebt = Math.mulDivDown(value, target, WAD);
        uint256 shortfall = debt > allowedDebt ? debt - allowedDebt : 0;
        if (shortfall == 0) return (ltv, target, 0, mark);

        /**
         * A cure repays R and seizes R * (1 + bonus) of collateral value, so the collateral falls
         * as the debt falls. Repaying only the shortfall would leave the position still above
         * target. Solving (debt - R) / (value - R(1+b)) = target gives
         *
         *     R = (debt - target * value) / (1 - target * (1 + b))
         *
         * Rounded up, against the borrower. If target * (1 + b) >= 1 no partial repayment can
         * reach the target at all, and the honest answer is that the whole debt is required.
         */
        uint256 targetWithBonus = Math.mulDivUp(target, WAD + c.cureBonus, WAD);
        if (targetWithBonus >= WAD) return (ltv, target, debt, mark);
        required = Math.mulDivUp(shortfall, WAD, WAD - targetWithBonus);
        if (required > debt) required = debt;
    }

    // ================================================================ liquidation

    /**
     * @notice The ordinary default path, available only when the position is below the fixed
     *         liquidation threshold. The threshold does not move with the session.
     */
    function liquidate(address user, bytes32 assetId, uint256 repayAmount)
        external
        accrues
        nonReentrant
        returns (uint256 repaid, uint256 seized)
    {
        CollateralConfig memory c = _config(assetId);
        uint256 hf = _healthFactor(user, assetId, c);
        if (hf >= WAD) revert NotLiquidatable(hf);

        Position memory p = _positions[user][assetId];
        uint256 debt = _debtOf(p.debtShares);
        uint256 maxRepay = Math.mulDivDown(debt, c.closeFactor, WAD);
        if (repayAmount == 0) revert ZeroAmount();
        if (repayAmount > maxRepay) revert CloseFactorExceeded(repayAmount, maxRepay);

        (,, uint128 creditMark,,) = terms.effectiveTerms(assetId);
        if (creditMark == 0) revert MarkUnavailable(assetId);

        repaid = _repay(msg.sender, user, assetId, repayAmount);
        seized = _seize(user, assetId, c, repaid, c.defaultBonus, creditMark);
        emit Liquidated(msg.sender, user, assetId, repaid, seized);
    }

    /**
     * @dev Collateral seized for a repayment plus its bonus, rounded DOWN: the protocol never
     *      hands out more collateral than the arithmetic strictly requires.
     */
    function _seize(
        address user,
        bytes32 assetId,
        CollateralConfig memory c,
        uint256 repaid,
        uint256 bonus,
        uint256 mark
    ) internal returns (uint256 seized) {
        uint256 grossValue = repaid + Math.mulDivDown(repaid, bonus, WAD);
        seized = _valueToCollateral(grossValue, c, mark);
        Position storage p = _positions[user][assetId];
        if (seized > p.collateralShares) seized = p.collateralShares;
        if (seized == 0) return 0;
        p.collateralShares -= uint128(seized);
        c.token.safeTransfer(msg.sender, seized);
    }

    // ================================================================ views

    function position(address user, bytes32 assetId) external view returns (Position memory) {
        return _positions[user][assetId];
    }

    function collateral(bytes32 assetId) external view returns (CollateralConfig memory) {
        return _collateral[assetId];
    }

    function debtOf(address user, bytes32 assetId) external view returns (uint256) {
        return _debtOf(_positions[user][assetId].debtShares);
    }

    function suppliedOf(address user) external view returns (uint256) {
        return Math.mulDivDown(supplyShares[user], totalSuppliedAssets + VIRTUAL, totalSupplyShares + VIRTUAL);
    }

    /// @notice Health against the FIXED liquidation threshold. Below 1e18 the position may be liquidated.
    function healthFactor(address user, bytes32 assetId) external view returns (uint256) {
        return _healthFactor(user, assetId, _config(assetId));
    }

    function positionLTV(address user, bytes32 assetId) external view returns (uint256) {
        CollateralConfig memory c = _config(assetId);
        Position memory p = _positions[user][assetId];
        if (p.debtShares == 0) return 0;
        (,, uint128 mark,,) = terms.effectiveTerms(assetId);
        uint256 value = _collateralValue(p.collateralShares, c, mark);
        if (value == 0) return type(uint256).max;
        return Math.mulDivUp(_debtOf(p.debtShares), WAD, value);
    }

    function _healthFactor(address user, bytes32 assetId, CollateralConfig memory c) internal view returns (uint256) {
        Position memory p = _positions[user][assetId];
        uint256 debt = _debtOf(p.debtShares);
        if (debt == 0) return type(uint256).max;
        (,, uint128 mark,,) = terms.effectiveTerms(assetId);
        if (mark == 0) revert MarkUnavailable(assetId);
        uint256 value = _collateralValue(p.collateralShares, c, mark);
        // Health rounds down, so a position on the line is treated as unsafe rather than safe.
        return Math.mulDivDown(Math.mulDivDown(value, c.liquidationThreshold, WAD), WAD, debt);
    }

    // ================================================================ internals

    function _config(bytes32 assetId) internal view returns (CollateralConfig memory c) {
        c = _collateral[assetId];
        if (!c.listed) revert UnknownCollateral(assetId);
    }

    function _debtOf(uint256 shares) internal view returns (uint256) {
        if (shares == 0) return 0;
        // Debt rounds up: the borrower is never told they owe less than they do.
        return Math.mulDivUp(shares, totalDebtAssets + VIRTUAL, totalDebtShares + VIRTUAL);
    }

    /**
     * @dev Collateral is valued as wrapper.convertToAssets(amount) * creditMark, scaled to the
     *      loan asset's decimals. The wrapper exchange rate is never used as a price: it converts
     *      shares to underlying units, and only the Credit Mark prices those units.
     */
    function _collateralValue(uint256 amount, CollateralConfig memory c, uint256 mark)
        internal
        view
        returns (uint256)
    {
        if (amount == 0 || mark == 0) return 0;
        uint256 underlying = address(c.wrapper) == address(0) ? amount : c.wrapper.convertToAssets(amount);
        // underlying is in token decimals; mark is 1e18 per whole token; result in loan decimals.
        uint256 value = Math.mulDivDown(underlying, mark, WAD);
        return _rescale(value, c.tokenDecimals, loanDecimals, false);
    }

    /// @dev The inverse, rounded down so a seizure never over-collects.
    function _valueToCollateral(uint256 value, CollateralConfig memory c, uint256 mark)
        internal
        view
        returns (uint256)
    {
        if (value == 0 || mark == 0) return 0;
        uint256 inTokenDecimals = _rescale(value, loanDecimals, c.tokenDecimals, false);
        uint256 underlying = Math.mulDivDown(inTokenDecimals, WAD, mark);
        if (address(c.wrapper) == address(0)) return underlying;
        // shares = underlying / assetsPerShare, and assetsPerShare = convertToAssets(1 token).
        uint256 unit = 10 ** c.tokenDecimals;
        uint256 assetsPerUnit = c.wrapper.convertToAssets(unit);
        if (assetsPerUnit == 0) return 0;
        return Math.mulDivDown(underlying, unit, assetsPerUnit);
    }

    function _rescale(uint256 x, uint8 from, uint8 to, bool up) internal pure returns (uint256) {
        if (from == to) return x;
        if (from < to) return x * (10 ** (to - from));
        uint256 d = 10 ** (from - to);
        return up ? Math.divUp(x, d) : x / d;
    }
}

/// @dev Minimal fixed-point helpers with explicit rounding at every call site.
library Math {
    error MathOverflow();

    function mulDivDown(uint256 x, uint256 y, uint256 d) internal pure returns (uint256) {
        if (d == 0) revert MathOverflow();
        return (x * y) / d;
    }

    function mulDivUp(uint256 x, uint256 y, uint256 d) internal pure returns (uint256) {
        if (d == 0) revert MathOverflow();
        uint256 p = x * y;
        return p == 0 ? 0 : (p - 1) / d + 1;
    }

    function divUp(uint256 x, uint256 d) internal pure returns (uint256) {
        if (d == 0) revert MathOverflow();
        return x == 0 ? 0 : (x - 1) / d + 1;
    }
}
