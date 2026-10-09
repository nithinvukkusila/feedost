// The only way a screen writes money, a date or a phone number. Written by hand with no `Intl`,
// no `toLocale*` and no local-time getters, so the output is the same on every phone: a low-end
// WebView with partial ICU data, or a phone set to Hindi, cannot change it (spec F3, 31 to 39).

/** Integer paise to `₹1,23,456` (Indian grouping). Whole rupees have no decimals; any paise show two. */
export function formatRupees(paise: number): string {
  if (typeof paise !== "number" || !Number.isSafeInteger(paise) || paise < 0) {
    throw new RangeError(`formatRupees needs a whole number of paise, 0 or more; got ${String(paise)}`);
  }
  const rupees = String(Math.floor(paise / 100));
  const rest = paise % 100;
  const lastThree = rupees.slice(-3);
  const head = rupees.slice(0, -3);
  const grouped = head ? `${head.replace(/\B(?=(\d\d)+(?!\d))/g, ",")},${lastThree}` : lastThree;
  return `₹${grouped}${rest === 0 ? "" : `.${String(rest).padStart(2, "0")}`}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const PLAIN_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/;
const INDIA_OFFSET_MINUTES = 330; // UTC+5:30, no daylight saving

function invalidDate(value: unknown): never {
  throw new RangeError(`formatDate needs YYYY-MM-DD or an ISO timestamp with an offset; got ${JSON.stringify(value)}`);
}

function write(year: number, month: number, day: number): string {
  return `${String(day).padStart(2, "0")} ${MONTHS[month]} ${String(year).padStart(4, "0")}`;
}

/** `YYYY-MM-DD` or an ISO timestamp with an offset to `DD MMM YYYY`. A timestamp shows its India calendar day. */
export function formatDate(value: string): string {
  if (typeof value !== "string") return invalidDate(value);

  const plain = PLAIN_DATE.exec(value);
  if (plain) {
    const [year, month, day] = [Number(plain[1]), Number(plain[2]) - 1, Number(plain[3])];
    // Round trip: Date.UTC rolls 30 Feb over to 2 Mar, so a changed field means the date was never real.
    const check = new Date(Date.UTC(year, month, day));
    if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month || check.getUTCDate() !== day) {
      return invalidDate(value);
    }
    return write(year, month, day);
  }

  if (TIMESTAMP.test(value)) {
    const instant = Date.parse(value);
    if (Number.isNaN(instant)) return invalidDate(value);
    const india = new Date(instant + INDIA_OFFSET_MINUTES * 60_000);
    return write(india.getUTCFullYear(), india.getUTCMonth(), india.getUTCDate());
  }

  return invalidDate(value);
}

/** `+919876543210` to `+91 98765 43210`. Anything that is not a 10-digit +91 number comes back unchanged. */
export function formatPhone(value: string): string {
  const match = /^\+91(\d{5})(\d{5})$/.exec(value);
  return match ? `+91 ${match[1]} ${match[2]}` : value;
}
