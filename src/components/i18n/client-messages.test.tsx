import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider, useTranslations } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { pickNamespaces } from "./client-messages";

const messages = {
  common: { loading: "Loading…" },
  home: { placeholder: "Soon" },
  receipt: { title: "Receipt for {name}" },
};

afterEach(cleanup);

// `receipt` is not in en.json yet, so the typed hook is called through a loose type here.
type Loose = (namespace: string) => (key: string, values?: Record<string, string>) => string;

function Line({ ns, keyName, values }: { ns: string; keyName: string; values?: Record<string, string> }) {
  const t = (useTranslations as unknown as Loose)(ns);
  return <p data-testid="line">{t(keyName, values)}</p>;
}

describe("pickNamespaces", () => {
  it("keeps only the named namespaces", () => {
    expect(pickNamespaces(messages, ["receipt"])).toEqual({ receipt: { title: "Receipt for {name}" } });
    expect(pickNamespaces(messages, ["common", "home"])).toEqual({ common: messages.common, home: messages.home });
  });

  it("skips a namespace that does not exist", () => {
    expect(pickNamespaces(messages, ["nope"])).toEqual({});
  });
});

describe("a Client Component inside the provider", () => {
  it("translates with a picked namespace and fills a placeholder", () => {
    render(
      <NextIntlClientProvider locale="en" messages={pickNamespaces(messages, ["receipt"])}>
        <Line ns="receipt" keyName="title" values={{ name: "Asha" }} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByTestId("line").textContent).toBe("Receipt for Asha");
  });

  it("does not have a namespace that was not picked", () => {
    const onError = vi.fn();
    render(
      <NextIntlClientProvider locale="en" messages={pickNamespaces(messages, ["receipt"])} onError={onError}>
        <Line ns="home" keyName="placeholder" />
      </NextIntlClientProvider>,
    );
    expect(screen.getByTestId("line").textContent).not.toContain("Soon");
    expect(onError).toHaveBeenCalled();
  });
});
