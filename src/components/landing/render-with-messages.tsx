// Test helper: renders a landing component with a language's real messages, the way the page does.
import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import en from "../../../messages/en.json";
import hi from "../../../messages/hi.json";

const files = { en, hi };

export function renderLanding(ui: ReactElement, locale: keyof typeof files = "en") {
  return render(
    <NextIntlClientProvider locale={locale} messages={files[locale]}>
      {ui}
    </NextIntlClientProvider>,
  );
}
