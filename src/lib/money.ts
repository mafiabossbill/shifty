import { APP_CONFIG } from "@/lib/app-config";

/*
 * Money is stored as integer minor units + an ISO 4217 code (`amount_minor bigint`, `currency char(3)`),
 * exactly as payment providers send it. Floats never hold money; formatting happens only here.
 */

/** How amounts are shown where local practice differs from ISO (e.g. TZS has cents nobody uses). */
export const DISPLAY_DECIMALS: Readonly<Record<string, number>> = { TZS: 0 };
/** Local symbols that Intl only prints for a region locale (en-TZ, en-KE, en-UG). */
export const CURRENCY_SYMBOLS: Readonly<Record<string, string>> = { TZS: "TSh", KES: "KSh", UGX: "USh" };

/** ISO minor-unit digits: USD 2, JPY 0, KWD 3, TZS 2. */
export function minorDigits(currency: string): number {
  return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
}

/** Exact decimal string of a minor amount, e.g. (125050n, 2) → "1250.50". */
function decimalString(amountMinor: number | bigint | string, digits: number): string {
  const value = BigInt(amountMinor);
  const zero = BigInt(0);
  const sign = value < zero ? "-" : "";
  const abs = (value < zero ? -value : value).toString().padStart(digits + 1, "0");
  return digits === 0 ? `${sign}${abs}` : `${sign}${abs.slice(0, -digits)}.${abs.slice(-digits)}`;
}

/**
 * Formats a stored amount: formatMinor(125000000, "TZS") → "TSh 1,250,000"; formatMinor(1999, "USD") → "$19.99".
 * Accepts bigint and numeric strings (Postgres bigint arrives as a string) without losing precision.
 */
export function formatMinor(
  amountMinor: number | bigint | string,
  currency: string = APP_CONFIG.currency,
  options: { locale?: string; decimals?: number; compact?: boolean } = {},
): string {
  const digits = minorDigits(currency);
  const decimals = options.decimals ?? DISPLAY_DECIMALS[currency] ?? digits;
  const format = new Intl.NumberFormat(options.locale ?? APP_CONFIG.locale, {
    style: "currency",
    currency,
    minimumFractionDigits: options.compact ? 0 : decimals,
    maximumFractionDigits: options.compact ? 1 : decimals,
    notation: options.compact ? "compact" : "standard",
  });
  const symbol = CURRENCY_SYMBOLS[currency];
  return format
    .formatToParts(decimalString(amountMinor, digits) as Intl.StringNumericLiteral)
    .map((part) => (part.type === "currency" && symbol ? symbol : part.value))
    .join("");
}

/**
 * Parses what a person typed into minor units, or null: toMinor("1,250,000", "TZS") → 125000000,
 * toMinor("19.999", "USD") → null (more decimals than the currency has).
 */
export function toMinor(input: string | number, currency: string = APP_CONFIG.currency): number | null {
  const text = String(input).trim().replace(/[\s,_]/g, "");
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) return null;
  const digits = minorDigits(currency);
  const fraction = match[3] ?? "";
  if (fraction.length > digits) return null;
  const minor = BigInt(`${match[1]}${match[2]}${fraction.padEnd(digits, "0")}`);
  return minor >= BigInt(Number.MIN_SAFE_INTEGER) && minor <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(minor) : null;
}

/** Major units as a number, for charts and sorting only (never for arithmetic you store). */
export function fromMinor(amountMinor: number | bigint | string, currency: string = APP_CONFIG.currency): number {
  return Number(decimalString(amountMinor, minorDigits(currency)));
}
