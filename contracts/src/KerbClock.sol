// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/**
 * @title KerbClock
 * @notice Per-asset market calendars resolved deterministically from chain time.
 *         The calendar is the halt-synchronisation primitive: it answers what session an
 *         underlying market is in, when it next changes, when it next weakens, and whether
 *         the Last Call cure window is open.
 * @dev Holds no funds. Calendars and holidays are set by a timelocked admin; only expiring
 *      halt flags may be set by an attester. Sessions never move a liquidation threshold.
 */
contract KerbClock {
    // ---------------------------------------------------------------- types

    /// @dev Matches the TypeScript Regime enum and KTS-0.1 section 4.1 ordering.
    enum Regime {
        DEEP,
        NORMAL,
        THIN,
        PRE_TRANSITION,
        REFERENCE_CLOSED,
        ACTION,
        HALTED,
        STALE,
        RECOVERY
    }

    /// @dev Session kinds, ordered by liquidity strength. CLOSED is the absence of a session.
    enum SessionKind {
        CLOSED,
        LUNCH,
        PRE,
        POST,
        REGULAR
    }

    /// @dev Transition kinds reported by nextTransition / nextWeakening.
    enum TransitionKind {
        NONE,
        PRE_OPEN,
        SESSION_OPEN,
        LUNCH_BREAK,
        LUNCH_END,
        SESSION_CLOSE,
        EARLY_CLOSE,
        POST_CLOSE
    }

    /// @dev A session window in local wall-clock minutes from local midnight. endMin may be 1440.
    struct Session {
        uint16 startMin;
        uint16 endMin;
        SessionKind kind;
    }

    /// @dev Daylight saving rule. NONE is a fixed offset (Hong Kong). US_DST is the United States rule.
    enum DstRule {
        NONE,
        US_DST
    }

    struct MarketCalendar {
        bool exists;
        DstRule dstRule;
        /// @dev Base (standard time) offset from UTC in minutes; may be negative.
        int32 utcOffsetMin;
        /// @dev Minutes added while daylight saving is in force.
        uint16 dstOffsetMin;
        /// @dev Local dates outside [coverageFromDay, coverageToDay] are refused, never guessed.
        uint32 coverageFromDay;
        uint32 coverageToDay;
    }

    struct AssetMarket {
        bytes8 marketCode;
        uint32 cureWindowSec;
        bool exists;
    }

    struct Halt {
        bool halted;
        uint64 expiry;
    }

    // ---------------------------------------------------------------- storage

    /// @dev Set at deployment to the bootstrap admin so calendars and guardrails can be loaded,
    ///      then handed to the real timelock by the timelock itself. Only it can move the role on.
    address public timelock;
    address public admin;

    mapping(bytes8 => MarketCalendar) private _calendars;
    /// @dev market => weekday (0 = Sunday) => sessions
    mapping(bytes8 => mapping(uint8 => Session[])) private _weekly;
    /// @dev market => local day number => sessions replacing the weekly template
    mapping(bytes8 => mapping(uint32 => Session[])) private _dayOverride;
    mapping(bytes8 => mapping(uint32 => bool)) private _hasOverride;
    mapping(bytes32 => AssetMarket) private _assetMarket;
    mapping(bytes32 => Halt) private _halts;
    mapping(address => bool) public isAttester;

    /// @dev Bound on the forward search so every view terminates.
    uint256 private constant MAX_SEARCH_DAYS = 30;
    uint256 private constant SECONDS_PER_DAY = 86400;

    // ---------------------------------------------------------------- events

    event CalendarSet(bytes8 indexed marketCode, int32 utcOffsetMin, DstRule dstRule, uint32 coverageFromDay, uint32 coverageToDay);
    event WeeklySet(bytes8 indexed marketCode, uint8 indexed weekday, uint256 sessions);
    event DayOverrideSet(bytes8 indexed marketCode, uint32 indexed localDay, uint256 sessions);
    event AssetMarketSet(bytes32 indexed assetId, bytes8 indexed marketCode, uint32 cureWindowSec);
    event AttesterSet(address indexed attester, bool allowed);
    event HaltSet(bytes32 indexed assetId, bool halted, uint64 expiry);
    event AdminSet(address indexed admin);
    event TimelockSet(address indexed timelock);

    // ---------------------------------------------------------------- errors

    error NotTimelock();
    error ZeroAddress();
    error NotAdmin();
    error NotAttester();
    error UnknownMarket(bytes8 marketCode);
    error UnknownAsset(bytes32 assetId);
    error OutOfCoverage(uint32 localDay);
    error BadSession();
    error HaltNotExpiring();
    error NoTransitionFound();

    // ---------------------------------------------------------------- modifiers

    modifier onlyTimelock() {
        if (msg.sender != timelock) revert NotTimelock();
        _;
    }

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    modifier onlyAttester() {
        if (!isAttester[msg.sender]) revert NotAttester();
        _;
    }

    constructor(address timelock_, address admin_) {
        if (timelock_ == address(0) || admin_ == address(0)) revert ZeroAddress();
        timelock = timelock_;
        admin = admin_;
        emit AdminSet(admin_);
        emit TimelockSet(timelock_);
    }

    // ---------------------------------------------------------------- admin

    /// @notice Hand the timelocked role to another address. Only the current holder may do it.
    function setTimelock(address newTimelock) external onlyTimelock {
        if (newTimelock == address(0)) revert ZeroAddress();
        timelock = newTimelock;
        emit TimelockSet(newTimelock);
    }

    function setAdmin(address newAdmin) external onlyTimelock {
        admin = newAdmin;
        emit AdminSet(newAdmin);
    }

    function setAttester(address attester, bool allowed) external onlyAdmin {
        isAttester[attester] = allowed;
        emit AttesterSet(attester, allowed);
    }

    function setCalendar(bytes8 marketCode, MarketCalendar calldata c) external onlyTimelock {
        if (c.coverageToDay < c.coverageFromDay) revert BadSession();
        _calendars[marketCode] = MarketCalendar({
            exists: true,
            dstRule: c.dstRule,
            utcOffsetMin: c.utcOffsetMin,
            dstOffsetMin: c.dstOffsetMin,
            coverageFromDay: c.coverageFromDay,
            coverageToDay: c.coverageToDay
        });
        emit CalendarSet(marketCode, c.utcOffsetMin, c.dstRule, c.coverageFromDay, c.coverageToDay);
    }

    function setWeekly(bytes8 marketCode, uint8 weekday, Session[] calldata sessions) external onlyTimelock {
        if (!_calendars[marketCode].exists) revert UnknownMarket(marketCode);
        if (weekday > 6) revert BadSession();
        _validate(sessions);
        delete _weekly[marketCode][weekday];
        for (uint256 i; i < sessions.length; ++i) _weekly[marketCode][weekday].push(sessions[i]);
        emit WeeklySet(marketCode, weekday, sessions.length);
    }

    /// @notice A holiday is an override with no sessions. Early closes and half days are overrides with shorter ones.
    function setDayOverride(bytes8 marketCode, uint32 localDay, Session[] calldata sessions) external onlyTimelock {
        if (!_calendars[marketCode].exists) revert UnknownMarket(marketCode);
        _validate(sessions);
        delete _dayOverride[marketCode][localDay];
        for (uint256 i; i < sessions.length; ++i) _dayOverride[marketCode][localDay].push(sessions[i]);
        _hasOverride[marketCode][localDay] = true;
        emit DayOverrideSet(marketCode, localDay, sessions.length);
    }

    function setAssetMarket(bytes32 assetId, bytes8 marketCode, uint32 cureWindowSec) external onlyTimelock {
        if (!_calendars[marketCode].exists) revert UnknownMarket(marketCode);
        _assetMarket[assetId] = AssetMarket({marketCode: marketCode, cureWindowSec: cureWindowSec, exists: true});
        emit AssetMarketSet(assetId, marketCode, cureWindowSec);
    }

    /// @notice Halt flags always expire, so a compromised attester cannot freeze an asset forever.
    function setHalt(bytes32 assetId, bool halted, uint64 expiry) external onlyAttester {
        if (halted && expiry <= block.timestamp) revert HaltNotExpiring();
        _halts[assetId] = Halt({halted: halted, expiry: expiry});
        emit HaltSet(assetId, halted, expiry);
    }

    // ---------------------------------------------------------------- views

    function calendar(bytes8 marketCode) external view returns (MarketCalendar memory) {
        return _calendars[marketCode];
    }

    function assetMarket(bytes32 assetId) external view returns (AssetMarket memory) {
        return _assetMarket[assetId];
    }

    function isHalted(bytes32 assetId, uint64 ts) public view returns (bool) {
        Halt memory h = _halts[assetId];
        return h.halted && h.expiry > ts;
    }

    function weekly(bytes8 marketCode, uint8 weekday) external view returns (Session[] memory) {
        return _weekly[marketCode][weekday];
    }

    function dayOverride(bytes8 marketCode, uint32 localDay) external view returns (bool set, Session[] memory) {
        return (_hasOverride[marketCode][localDay], _dayOverride[marketCode][localDay]);
    }

    /// @notice The session an asset's underlying market is in at `ts`.
    function sessionAt(bytes32 assetId, uint64 ts) public view returns (SessionKind kind, uint64 startsAt, uint64 endsAt) {
        return _sessionAtMarket(_market(assetId), ts);
    }

    /// @notice Calendar-only regime. Depth and source freshness are not onchain inputs.
    function calendarRegime(bytes32 assetId, uint64 ts) external view returns (Regime) {
        if (isHalted(assetId, ts)) return Regime.HALTED;
        (bool open,) = cureWindowOpen(assetId, ts);
        if (open) return Regime.PRE_TRANSITION;
        (SessionKind kind,,) = sessionAt(assetId, ts);
        if (kind == SessionKind.CLOSED) return Regime.REFERENCE_CLOSED;
        return Regime.NORMAL;
    }

    /// @notice The next session boundary of any kind.
    function nextTransition(bytes32 assetId, uint64 ts) public view returns (uint8 kind, uint64 at) {
        (TransitionKind k, uint64 a,) = _nextTransition(_market(assetId), ts, false);
        return (uint8(k), a);
    }

    /// @notice The next exit from the main session: the deadline a Session Max position cures by.
    function nextWeakening(bytes32 assetId, uint64 ts) public view returns (uint8 kind, uint64 at) {
        (TransitionKind k, uint64 a,) = _nextTransition(_market(assetId), ts, true);
        return (uint8(k), a);
    }

    /// @notice Last Call: open in the configured window before the next weakening.
    function cureWindowOpen(bytes32 assetId, uint64 ts) public view returns (bool open, uint64 closesAt) {
        AssetMarket memory am = _assetMarket[assetId];
        if (!am.exists) revert UnknownAsset(assetId);
        (, uint64 at,) = _nextTransition(am.marketCode, ts, true);
        uint64 opensAt = at - uint64(am.cureWindowSec);
        return (ts >= opensAt && ts < at, at);
    }

    // ---------------------------------------------------------------- internals

    function _market(bytes32 assetId) private view returns (bytes8) {
        AssetMarket memory am = _assetMarket[assetId];
        if (!am.exists) revert UnknownAsset(assetId);
        return am.marketCode;
    }

    function _validate(Session[] calldata sessions) private pure {
        uint16 last;
        for (uint256 i; i < sessions.length; ++i) {
            Session calldata s = sessions[i];
            if (s.endMin <= s.startMin || s.endMin > 1440) revert BadSession();
            if (s.startMin < last) revert BadSession();
            if (s.kind == SessionKind.CLOSED) revert BadSession();
            last = s.endMin;
        }
    }

    /// @dev Local day number and minute-of-day for an instant, honouring the market's DST rule.
    function _localParts(bytes8 marketCode, uint64 ts) private view returns (uint32 day, uint32 minuteOfDay) {
        MarketCalendar memory c = _calendars[marketCode];
        if (!c.exists) revert UnknownMarket(marketCode);
        int256 local = int256(uint256(ts)) + int256(_offsetSeconds(c, ts));
        if (local < 0) revert OutOfCoverage(0);
        uint256 l = uint256(local);
        day = uint32(l / SECONDS_PER_DAY);
        minuteOfDay = uint32((l % SECONDS_PER_DAY) / 60);
        if (day < c.coverageFromDay || day > c.coverageToDay) revert OutOfCoverage(day);
    }

    function _offsetSeconds(MarketCalendar memory c, uint64 ts) private pure returns (int256) {
        int256 base = int256(c.utcOffsetMin) * 60;
        if (c.dstRule == DstRule.NONE) return base;
        return _usDstActive(ts, base, int256(uint256(c.dstOffsetMin)) * 60) ? base + int256(uint256(c.dstOffsetMin)) * 60 : base;
    }

    /**
     * @dev United States rule: daylight time runs from 02:00 local standard time on the second
     *      Sunday in March to 02:00 local daylight time on the first Sunday in November.
     */
    function _usDstActive(uint64 ts, int256 baseOffset, int256 dstOffset) private pure returns (bool) {
        int256 standardLocal = int256(uint256(ts)) + baseOffset;
        if (standardLocal < 0) return false;
        (uint256 y,,) = _civilFromDays(uint256(standardLocal) / SECONDS_PER_DAY);
        uint256 startDay = _nthWeekdayOfMonth(y, 3, 0, 2); // second Sunday in March
        uint256 endDay = _nthWeekdayOfMonth(y, 11, 0, 1); // first Sunday in November
        int256 startsAt = int256(startDay * SECONDS_PER_DAY + 2 hours) - baseOffset;
        int256 endsAt = int256(endDay * SECONDS_PER_DAY + 2 hours) - baseOffset - dstOffset;
        int256 t = int256(uint256(ts));
        return t >= startsAt && t < endsAt;
    }

    /// @dev Day number of the nth `weekday` (0 = Sunday) of a month.
    function _nthWeekdayOfMonth(uint256 y, uint256 m, uint256 weekday, uint256 nth) private pure returns (uint256) {
        uint256 first = _daysFromCivil(y, m, 1);
        uint256 dow = (first + 4) % 7; // 1970-01-01 was a Thursday
        uint256 delta = (7 + weekday - dow) % 7;
        return first + delta + (nth - 1) * 7;
    }

    /// @dev Howard Hinnant's civil calendar algorithms, valid for the proleptic Gregorian calendar.
    function _daysFromCivil(uint256 y, uint256 m, uint256 d) private pure returns (uint256) {
        uint256 yy = m <= 2 ? y - 1 : y;
        uint256 era = yy / 400;
        uint256 yoe = yy - era * 400;
        uint256 doy = (153 * (m > 2 ? m - 3 : m + 9) + 2) / 5 + d - 1;
        uint256 doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
        return era * 146097 + doe - 719468;
    }

    function _civilFromDays(uint256 z) private pure returns (uint256 y, uint256 m, uint256 d) {
        uint256 zz = z + 719468;
        uint256 era = zz / 146097;
        uint256 doe = zz - era * 146097;
        uint256 yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
        uint256 yy = yoe + era * 400;
        uint256 doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
        uint256 mp = (5 * doy + 2) / 153;
        d = doy - (153 * mp + 2) / 5 + 1;
        m = mp < 10 ? mp + 3 : mp - 9;
        y = m <= 2 ? yy + 1 : yy;
    }

    function _weekdayOf(uint32 day) private pure returns (uint8) {
        return uint8((uint256(day) + 4) % 7);
    }

    function _sessionsFor(bytes8 marketCode, uint32 localDay) private view returns (Session[] memory) {
        if (_hasOverride[marketCode][localDay]) return _dayOverride[marketCode][localDay];
        return _weekly[marketCode][_weekdayOf(localDay)];
    }

    /// @dev UTC instant of a local wall-clock minute on a local day.
    function _utcOf(bytes8 marketCode, uint32 localDay, uint32 minute) private view returns (uint64) {
        MarketCalendar memory c = _calendars[marketCode];
        int256 naive = int256(uint256(localDay) * SECONDS_PER_DAY + uint256(minute) * 60);
        int256 guess = naive - int256(_offsetSeconds(c, uint64(uint256(naive))));
        // One correction pass: the offset at the candidate instant decides the answer.
        int256 corrected = naive - int256(_offsetSeconds(c, uint64(uint256(guess))));
        return uint64(uint256(corrected));
    }

    function _sessionAtMarket(bytes8 marketCode, uint64 ts) private view returns (SessionKind kind, uint64 startsAt, uint64 endsAt) {
        (uint32 day,) = _localParts(marketCode, ts);
        // Look at the previous, current and next local day so sessions crossing midnight resolve.
        for (uint32 i; i < 3; ++i) {
            uint32 d = day + i - 1;
            Session[] memory ss = _sessionsFor(marketCode, d);
            for (uint256 j; j < ss.length; ++j) {
                uint64 s = _utcOf(marketCode, d, ss[j].startMin);
                uint64 e = _utcOf(marketCode, d, ss[j].endMin);
                if (ts >= s && ts < e) return (ss[j].kind, s, e);
            }
        }
        // Closed: report the gap between the previous session end and the next session start.
        (uint64 prevEnd, uint64 nextStart) = _gapAround(marketCode, ts, day);
        return (SessionKind.CLOSED, prevEnd, nextStart);
    }

    function _gapAround(bytes8 marketCode, uint64 ts, uint32 day) private view returns (uint64 prevEnd, uint64 nextStart) {
        prevEnd = 0;
        nextStart = type(uint64).max;
        for (uint256 i; i <= MAX_SEARCH_DAYS; ++i) {
            uint32 d = uint32(uint256(day) + i);
            Session[] memory ss = _sessionsFor(marketCode, d);
            for (uint256 j; j < ss.length; ++j) {
                uint64 s = _utcOf(marketCode, d, ss[j].startMin);
                if (s > ts && s < nextStart) nextStart = s;
            }
            if (nextStart != type(uint64).max) break;
        }
        for (uint256 i; i <= MAX_SEARCH_DAYS; ++i) {
            uint32 d = uint32(uint256(day) - i);
            Session[] memory ss = _sessionsFor(marketCode, d);
            for (uint256 j; j < ss.length; ++j) {
                uint64 e = _utcOf(marketCode, d, ss[j].endMin);
                if (e <= ts && e > prevEnd) prevEnd = e;
            }
            if (prevEnd != 0) break;
        }
    }

    /**
     * @dev Walks forward from `ts` and returns the first boundary. When `weakeningOnly` is set,
     *      only an exit from REGULAR counts, which is the cure deadline a Session Max position faces.
     */
    function _nextTransition(bytes8 marketCode, uint64 ts, bool weakeningOnly)
        private
        view
        returns (TransitionKind kind, uint64 at, SessionKind toKind)
    {
        (SessionKind from,, uint64 end) = _sessionAtMarket(marketCode, ts);
        for (uint256 step; step < MAX_SEARCH_DAYS * 6; ++step) {
            if (end == type(uint64).max) break;
            (SessionKind next,, uint64 nextEnd) = _sessionAtMarket(marketCode, end);
            if (next != from && (!weakeningOnly || from == SessionKind.REGULAR)) {
                return (_transitionKind(marketCode, from, next, end), end, next);
            }
            from = next;
            end = nextEnd;
        }
        revert NoTransitionFound();
    }

    function _transitionKind(bytes8 marketCode, SessionKind from, SessionKind to, uint64 at)
        private
        view
        returns (TransitionKind)
    {
        if (to == SessionKind.REGULAR) return from == SessionKind.LUNCH ? TransitionKind.LUNCH_END : TransitionKind.SESSION_OPEN;
        if (to == SessionKind.PRE) return TransitionKind.PRE_OPEN;
        if (from == SessionKind.REGULAR && to == SessionKind.LUNCH) return TransitionKind.LUNCH_BREAK;
        if (from == SessionKind.REGULAR) {
            (uint32 day,) = _localParts(marketCode, at - 1);
            return _hasOverride[marketCode][day] ? TransitionKind.EARLY_CLOSE : TransitionKind.SESSION_CLOSE;
        }
        if (from == SessionKind.POST) return TransitionKind.POST_CLOSE;
        return TransitionKind.NONE;
    }
}
