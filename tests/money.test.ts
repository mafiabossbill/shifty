import { describe, expect, it } from "vitest";

import { formatMinor, fromMinor, minorDigits, toMinor } from "@/lib/money";

// Intl separates the symbol with a no-break space in some locales; compare with plain spaces.
const plain = (s: string) => s.replace(/ /g, " ");

describe("money", () => {
  it("knows each currency's minor units", () => {
    expect([minorDigits("USD"), minorDigits("JPY"), minorDigits("KWD"), minorDigits("TZS")]).toEqual([2, 0, 3, 2]);
  });

  it("formats stored minor units", () => {
    expect(formatMinor(1999, "USD")).toBe("$19.99");
    expect(plain(formatMinor(125_000_000, "TZS"))).toBe("TSh 1,250,000");
    expect(formatMinor(1500, "JPY")).toBe("¥1,500");
    expect(plain(formatMinor(1234, "KWD"))).toBe("KWD 1.234");
    expect(formatMinor(-500, "USD")).toBe("-$5.00");
    expect(formatMinor(1999, "USD", { compact: true })).toBe("$20");
    expect(formatMinor(250_000_000, "USD", { compact: true })).toBe("$2.5M");
  });

  it("keeps precision for Postgres bigint values beyond 2^53", () => {
    expect(formatMinor("900719925474099312", "USD")).toBe("$9,007,199,254,740,993.12");
    expect(formatMinor(BigInt(12), "USD")).toBe("$0.12");
  });

  it("parses typed amounts exactly or refuses them", () => {
    expect(toMinor("19.99", "USD")).toBe(1999);
    expect(toMinor("0.1", "USD")).toBe(10);
    expect(toMinor(" 1,250,000 ", "TZS")).toBe(125_000_000);
    expect(toMinor("1500", "JPY")).toBe(1500);
    expect(toMinor("-5", "USD")).toBe(-500);
    expect(toMinor("19.999", "USD")).toBeNull();
    expect(toMinor("1.5", "JPY")).toBeNull();
    expect(toMinor("abc", "USD")).toBeNull();
    expect(toMinor("", "USD")).toBeNull();
    expect(toMinor("99999999999999999", "USD")).toBeNull();
  });

  it("converts to major units for charts", () => {
    expect(fromMinor(1999, "USD")).toBe(19.99);
    expect(fromMinor(1500, "JPY")).toBe(1500);
  });
});
