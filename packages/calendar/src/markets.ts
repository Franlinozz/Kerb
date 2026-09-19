/**
 * Per-market trading calendars, 2026 to 2027. Local wall-clock times in the market's IANA zone.
 *
 * Sources: NYSE holiday and early-close schedule; HKEX trading calendar and the HKSAR
 * general holidays gazette; CME Globex metals holiday schedule. The 2026 HK list, the US
 * list from Sep 2026 to Jul 2027 and the 2026 CME silver list were cross-checked against
 * the machine-readable schedules published in the Pyth feed catalogue (fixtures in
 * data/fixtures/calendar). HK 2027 lunar-calendar dates are derived, not yet cross-checked.
 */
import type { MarketCode } from "@kerb/types";

export type SessionKind = "PRE" | "REGULAR" | "LUNCH" | "POST" | "CLOSED";

/** Liquidity strength of a session. A move to a lower strength is a weakening. */
export const STRENGTH: Record<SessionKind, number> = { REGULAR: 3, PRE: 2, POST: 2, LUNCH: 1, CLOSED: 0 };

export interface SessionTemplate {
  kind: Exclude<SessionKind, "CLOSED">;
  /** "HH:MM" local, inclusive. */
  start: string;
  /** "HH:MM" local, exclusive; "24:00" allowed. */
  end: string;
}

export interface DayOverride {
  reason: "HOLIDAY" | "EARLY_CLOSE" | "HALF_DAY" | "HOLIDAY_HOURS";
  name: string;
  /** Sessions for that local date; empty means closed all day. */
  sessions: SessionTemplate[];
}

export interface MarketSpec {
  code: MarketCode;
  name: string;
  tz: string;
  /** Index 0 = Sunday. */
  weekly: SessionTemplate[][];
  overrides: Record<string, DayOverride>;
  /** Default Last Call length before a weakening, seconds. Configuration, versioned with the calendar. */
  defaultCureWindowSec: number;
  sourceNote: string;
}

const s = (kind: SessionTemplate["kind"], start: string, end: string): SessionTemplate => ({ kind, start, end });

// ---------------------------------------------------------------- US equities (XNYS, XNAS, ARCX)
const US_DAY = [s("PRE", "04:00", "09:30"), s("REGULAR", "09:30", "16:00"), s("POST", "16:00", "20:00")];
const US_EARLY = [s("PRE", "04:00", "09:30"), s("REGULAR", "09:30", "13:00"), s("POST", "13:00", "17:00")];
const closed = (name: string): DayOverride => ({ reason: "HOLIDAY", name, sessions: [] });
const usEarly = (name: string): DayOverride => ({ reason: "EARLY_CLOSE", name, sessions: US_EARLY });

const US_OVERRIDES: Record<string, DayOverride> = {
  "2025-12-24": usEarly("Christmas Eve"),
  "2025-12-25": closed("Christmas Day"),
  "2026-01-01": closed("New Year's Day"),
  "2026-01-19": closed("Martin Luther King Jr. Day"),
  "2026-02-16": closed("Washington's Birthday"),
  "2026-04-03": closed("Good Friday"),
  "2026-05-25": closed("Memorial Day"),
  "2026-06-19": closed("Juneteenth"),
  "2026-07-03": closed("Independence Day (observed)"),
  "2026-09-07": closed("Labor Day"),
  "2026-11-26": closed("Thanksgiving Day"),
  "2026-11-27": usEarly("Day after Thanksgiving"),
  "2026-12-24": usEarly("Christmas Eve"),
  "2026-12-25": closed("Christmas Day"),
  "2027-01-01": closed("New Year's Day"),
  "2027-01-18": closed("Martin Luther King Jr. Day"),
  "2027-02-15": closed("Washington's Birthday"),
  "2027-03-26": closed("Good Friday"),
  "2027-05-31": closed("Memorial Day"),
  "2027-06-18": closed("Juneteenth (observed)"),
  "2027-07-05": closed("Independence Day (observed)"),
  "2027-09-06": closed("Labor Day"),
  "2027-11-25": closed("Thanksgiving Day"),
  "2027-11-26": usEarly("Day after Thanksgiving"),
  "2027-12-24": closed("Christmas Day (observed)"),
};

const WEEKDAYS = <T>(day: T[]): T[][] => [[], day, day, day, day, day, []];

const usMarket = (code: MarketCode, name: string): MarketSpec => ({
  code, name, tz: "America/New_York", weekly: WEEKDAYS(US_DAY), overrides: US_OVERRIDES, defaultCureWindowSec: 3600,
  sourceNote: "NYSE/Nasdaq hours: pre 04:00-09:30, regular 09:30-16:00, post 16:00-20:00 ET; early closes 13:00 with post to 17:00. NYSE holiday list 2026-2027.",
});

// ---------------------------------------------------------------- Hong Kong (XHKG)
// Pre-opening auction 09:00-09:30, morning 09:30-12:00, lunch 12:00-13:00, afternoon 13:00-16:00,
// closing auction 16:00-16:10. Half days: morning only, closing auction 12:00-12:10.
const HK_DAY = [s("PRE", "09:00", "09:30"), s("REGULAR", "09:30", "12:00"), s("LUNCH", "12:00", "13:00"), s("REGULAR", "13:00", "16:00"), s("POST", "16:00", "16:10")];
const HK_HALF = [s("PRE", "09:00", "09:30"), s("REGULAR", "09:30", "12:00"), s("POST", "12:00", "12:10")];
const hkHalf = (name: string): DayOverride => ({ reason: "HALF_DAY", name, sessions: HK_HALF });

const HK_OVERRIDES: Record<string, DayOverride> = {
  "2025-12-24": hkHalf("Christmas Eve"),
  "2025-12-25": closed("Christmas Day"),
  "2025-12-26": closed("The first weekday after Christmas Day"),
  "2025-12-31": hkHalf("New Year's Eve"),
  "2026-01-01": closed("The first day of January"),
  "2026-02-16": hkHalf("Lunar New Year's Eve"),
  "2026-02-17": closed("Lunar New Year's Day"),
  "2026-02-18": closed("The second day of Lunar New Year"),
  "2026-02-19": closed("The third day of Lunar New Year"),
  "2026-04-03": closed("Good Friday"),
  "2026-04-06": closed("The day following Ching Ming Festival"),
  "2026-04-07": closed("The day following Easter Monday"),
  "2026-05-01": closed("Labour Day"),
  "2026-05-25": closed("The day following the Birthday of the Buddha"),
  "2026-06-19": closed("Tuen Ng Festival"),
  "2026-07-01": closed("HKSAR Establishment Day"),
  "2026-10-01": closed("National Day"),
  "2026-10-19": closed("The day following Chung Yeung Festival"),
  "2026-12-24": hkHalf("Christmas Eve"),
  "2026-12-25": closed("Christmas Day"),
  "2026-12-31": hkHalf("New Year's Eve"),
  "2027-01-01": closed("The first day of January"),
  "2027-02-05": hkHalf("Lunar New Year's Eve"),
  "2027-02-08": closed("The third day of Lunar New Year"),
  "2027-02-09": closed("The fourth day of Lunar New Year"),
  "2027-03-26": closed("Good Friday"),
  "2027-03-29": closed("Easter Monday"),
  "2027-04-05": closed("Ching Ming Festival"),
  "2027-05-13": closed("The Birthday of the Buddha"),
  "2027-06-09": closed("Tuen Ng Festival"),
  "2027-07-01": closed("HKSAR Establishment Day"),
  "2027-09-16": closed("The day following the Chinese Mid-Autumn Festival"),
  "2027-10-01": closed("National Day"),
  "2027-10-08": closed("Chung Yeung Festival"),
  "2027-12-24": hkHalf("Christmas Eve"),
  "2027-12-27": closed("The first weekday after Christmas Day"),
  "2027-12-31": hkHalf("New Year's Eve"),
};

// ---------------------------------------------------------------- CME Globex metals (XCOM), in ET
// Sunday 18:00 to Friday 17:00 ET with a daily 17:00-18:00 maintenance break.
const CM = [s("REGULAR", "00:00", "17:00"), s("REGULAR", "18:00", "24:00")];
const CM_WEEK: SessionTemplate[][] = [[s("REGULAR", "18:00", "24:00")], CM, CM, CM, CM, [s("REGULAR", "00:00", "17:00")], []];
const cmHalt = (name: string, halt: string): DayOverride => ({ reason: "HOLIDAY_HOURS", name, sessions: [s("REGULAR", "00:00", halt), s("REGULAR", "18:00", "24:00")] });
const cmClose = (name: string, close: string): DayOverride => ({ reason: "HOLIDAY_HOURS", name, sessions: [s("REGULAR", "00:00", close)] });

const XCOM_OVERRIDES: Record<string, DayOverride> = {
  "2025-12-24": cmClose("Christmas Eve", "13:45"),
  "2025-12-25": closed("Christmas Day"),
  "2025-12-31": cmClose("New Year's Eve", "17:00"),
  "2026-01-01": closed("New Year's Day"),
  "2026-01-19": cmHalt("Martin Luther King Jr. Day", "14:30"),
  "2026-02-16": cmHalt("Presidents Day", "14:30"),
  "2026-04-02": cmClose("Day before Good Friday", "17:00"),
  "2026-04-03": closed("Good Friday"),
  "2026-05-25": cmHalt("Memorial Day", "14:30"),
  "2026-06-19": cmClose("Juneteenth", "13:00"),
  "2026-07-03": cmClose("Independence Day (observed)", "13:00"),
  "2026-09-07": cmHalt("Labor Day", "14:30"),
  "2026-11-26": cmHalt("Thanksgiving Day", "14:30"),
  "2026-11-27": cmClose("Day after Thanksgiving", "14:45"),
  "2026-12-24": cmClose("Christmas Eve", "13:45"),
  "2026-12-25": closed("Christmas Day"),
  "2026-12-31": cmClose("New Year's Eve", "17:00"),
  "2027-01-01": closed("New Year's Day"),
  "2027-01-18": cmHalt("Martin Luther King Jr. Day", "14:30"),
  "2027-02-15": cmHalt("Presidents Day", "14:30"),
  "2027-03-25": cmClose("Day before Good Friday", "17:00"),
  "2027-03-26": closed("Good Friday"),
  "2027-05-31": cmHalt("Memorial Day", "14:30"),
  "2027-06-18": cmClose("Juneteenth (observed)", "13:00"),
  "2027-07-05": cmHalt("Independence Day (observed)", "13:00"),
  "2027-09-06": cmHalt("Labor Day", "14:30"),
  "2027-11-25": cmHalt("Thanksgiving Day", "14:30"),
  "2027-11-26": cmClose("Day after Thanksgiving", "14:45"),
  "2027-12-23": cmClose("Day before Christmas (observed)", "17:00"),
  "2027-12-24": closed("Christmas Day (observed)"),
};

export const MARKETS: Record<MarketCode, MarketSpec> = {
  XNYS: usMarket("XNYS", "New York Stock Exchange"),
  XNAS: usMarket("XNAS", "Nasdaq"),
  ARCX: usMarket("ARCX", "NYSE Arca"),
  XHKG: {
    code: "XHKG", name: "Hong Kong Exchanges", tz: "Asia/Hong_Kong", weekly: WEEKDAYS(HK_DAY), overrides: HK_OVERRIDES, defaultCureWindowSec: 1800,
    sourceNote: "HKEX securities market: pre-opening 09:00-09:30, morning 09:30-12:00, lunch 12:00-13:00, afternoon 13:00-16:00, closing auction 16:00-16:10 HKT. HKSAR general holidays 2026-2027.",
  },
  XCOM: {
    code: "XCOM", name: "CME Globex metals (COMEX)", tz: "America/New_York", weekly: CM_WEEK, overrides: XCOM_OVERRIDES, defaultCureWindowSec: 3600,
    sourceNote: "CME Globex metals: Sun 18:00 to Fri 17:00 ET with a daily 17:00-18:00 break; CME holiday schedule 2026-2027.",
  },
};

export const CALENDAR_VERSION = "kerb-calendar@0.1.0 (2025-12-01..2027-12-31)";
/** Inclusive local-date range with complete holiday data. Outside it the calendar refuses to answer. */
export const COVERAGE = { from: "2025-12-01", to: "2027-12-31" } as const;
