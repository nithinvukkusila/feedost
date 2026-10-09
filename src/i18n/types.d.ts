// Typed keys: t("nope") is a type error, and `locale` is one of the four codes.
import type { Locale } from "@/config/locales";
import type en from "../../messages/en.json";

declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof en;
  }
}
