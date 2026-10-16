// The pay page's address, for the reminder message (spec R1-9 criterion 45): `https://{host}/p/{pay_token}`. The host is
// the one site-address setting, `brand.domain`. The token pattern is the one `pay-page-public.ts` accepts, so a link
// built here is always one the page will open. Null for anything else: the reminder then carries the raw UPI link.
import { brand } from "@/config/brand";

const PAY_TOKEN = /^[A-Za-z0-9_-]{22,128}$/;

export function payPageLink(token: unknown): string | null {
  return typeof token === "string" && PAY_TOKEN.test(token) ? `https://${brand.domain}/p/${token}` : null;
}
