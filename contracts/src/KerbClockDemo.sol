// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/**
 * @title KerbClockDemo
 * @notice A compressed clock for demonstrations: one trading week per hour, so the whole
 *         covenant lifecycle — draw at Session Max, watch Last Call open, cure, repay — can be
 *         shown in minutes instead of days.
 *
 * This contract is NEVER deployed to mainnet. It carries a different name from KerbClock, emits
 * DEMO_CALENDAR on construction so any indexer can see what it is, and reports `isDemo() == true`.
 * Nothing here reads a real calendar: it is a sawtooth over block.timestamp.
 *
 * One demo week (default 1 hour) is laid out as:
 *   [0, openFraction)            the session is open
 *   [cureStart, sessionEnd)      Last Call: the cure window
 *   [sessionEnd, weekEnd)        closed
 */
contract KerbClockDemo {
    /// @notice Length of one compressed trading week, in seconds.
    uint64 public immutable weekLength;
    /// @notice How far into the week the session closes.
    uint64 public immutable sessionEnd;
    /// @notice How far into the week the Last Call window opens.
    uint64 public immutable cureStart;
    /// @notice Where the sawtooth begins, so the phase is reproducible.
    uint64 public immutable epoch;

    event DEMO_CALENDAR(uint64 weekLength, uint64 sessionEnd, uint64 cureStart, uint64 epoch, string warning);

    error BadSchedule();

    constructor(uint64 weekLength_, uint64 sessionEnd_, uint64 cureStart_, uint64 epoch_) {
        if (weekLength_ == 0 || sessionEnd_ > weekLength_ || cureStart_ >= sessionEnd_) revert BadSchedule();
        weekLength = weekLength_;
        sessionEnd = sessionEnd_;
        cureStart = cureStart_;
        epoch = epoch_;
        emit DEMO_CALENDAR(
            weekLength_, sessionEnd_, cureStart_, epoch_, "DEMO CLOCK, TESTNET ONLY, NOT A REAL MARKET CALENDAR"
        );
    }

    /// @notice Always true. A consumer can refuse to run against a demo clock by checking this.
    function isDemo() external pure returns (bool) {
        return true;
    }

    function phase(uint64 ts) public view returns (uint64) {
        return (ts - epoch) % weekLength;
    }

    /// @notice The same shape KerbClock exposes, so KerbCredit does not know the difference.
    function cureWindowOpen(bytes32, uint64 ts) external view returns (bool open, uint64 closesAt) {
        uint64 p = phase(ts);
        uint64 weekStart = ts - p;
        if (p >= cureStart && p < sessionEnd) return (true, weekStart + sessionEnd);
        return (false, weekStart + sessionEnd);
    }

    /// @notice The next time the session weakens: the end of this session, or the next one.
    function nextWeakening(bytes32, uint64 ts) external view returns (uint8 kind, uint64 at) {
        uint64 p = phase(ts);
        uint64 weekStart = ts - p;
        // 2 is SESSION_CLOSE in the KerbClock TransitionKind ordering.
        return (2, p < sessionEnd ? weekStart + sessionEnd : weekStart + weekLength + sessionEnd);
    }

    function sessionOpen(uint64 ts) external view returns (bool) {
        return phase(ts) < sessionEnd;
    }
}
