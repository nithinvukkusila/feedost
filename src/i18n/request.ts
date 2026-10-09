// next-intl finds this file by default. The locale comes from the route's root param, not from a
// request header, so every page stays static. Do not read the locale from the argument this function is given.
import { getRequestConfig } from "next-intl/server";
import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { isLocale } from "@/config/locales";
import { loadMessages } from "./messages";

export default getRequestConfig(async () => {
  const locale = await rootLocale();
  if (!isLocale(locale)) notFound();
  return { locale, messages: await loadMessages(locale) };
});
