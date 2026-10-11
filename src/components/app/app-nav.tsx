"use client";

// The bottom navigation of the signed-in app: Home, Students, Attendance, More (spec R1-3, criterion 2).
// A tap on one goes through the router, as every link in the app does (use-soft-link.ts), so the gate
// and the cached roster stay mounted. BottomNav draws plain links and takes no click handler, so the tap
// is caught here, on the wrapper.
import { useLocale, useTranslations } from "next-intl";
import type { MouseEvent } from "react";
import { BottomNav, type BottomNavItem, type BottomNavKey } from "@/components/ui/bottom-nav";
import type { Locale } from "@/config/locales";
import { attendancePath, homePath, localeHref, morePath, studentsPath } from "@/config/routes";
import { NavAttendanceIcon, NavHomeIcon, NavMoreIcon, NavStudentsIcon } from "./nav-icons";
import { useSoftLink } from "./use-soft-link";

export function AppNav({ current }: Readonly<{ current: BottomNavKey }>) {
  const t = useTranslations("nav");
  const locale = useLocale() as Locale;
  const soft = useSoftLink();

  const items: Record<BottomNavKey, BottomNavItem> = {
    home: { href: localeHref(locale, homePath), label: t("home"), icon: <NavHomeIcon /> },
    students: { href: localeHref(locale, studentsPath), label: t("students"), icon: <NavStudentsIcon /> },
    attendance: { href: localeHref(locale, attendancePath), label: t("attendance"), icon: <NavAttendanceIcon /> },
    more: { href: localeHref(locale, morePath), label: t("more"), icon: <NavMoreIcon /> },
  };

  function onClick(event: MouseEvent<HTMLDivElement>) {
    const link = (event.target as Element).closest("a[href]");
    if (link instanceof HTMLAnchorElement) soft(link.getAttribute("href") ?? "")(event as unknown as MouseEvent<HTMLAnchorElement>);
  }

  return (
    // The tap is the links' own; this only hands it to the router. Keyboard activation of a link is a click too.
    <div onClick={onClick}>
      <BottomNav label={t("label")} items={items} current={current} />
    </div>
  );
}
