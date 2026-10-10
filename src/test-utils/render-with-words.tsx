// Test helper: renders a client component with one language's real messages, the way a page does
// through ClientMessages. A value still marked TODO-translate shows its English text, as in the app.
import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import { stripTodo } from "@/i18n/messages";
import type { Locale } from "@/config/locales";
import en from "../../messages/en.json";
import hi from "../../messages/hi.json";
import kn from "../../messages/kn.json";
import te from "../../messages/te.json";

const files = { en, hi, kn, te };

export function renderWithWords(ui: ReactElement, locale: Locale = "en") {
  return render(
    <NextIntlClientProvider locale={locale} messages={stripTodo(files[locale] as Parameters<typeof stripTodo>[0])}>
      {ui}
    </NextIntlClientProvider>,
  );
}
