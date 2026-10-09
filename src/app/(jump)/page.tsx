// "/" is a static page of four plain links, one per language. The jump script arrives in a later step.
import { localeNames, locales } from "@/config/locales";

export default function JumpPage() {
  return (
    <main className="p-5">
      <ul className="mx-auto flex max-w-md flex-col gap-3">
        {locales.map((code) => (
          <li key={code}>
            <a
              href={`/${code}/`}
              lang={code}
              hrefLang={code}
              data-locale={code}
              className="type-body flex min-h-11 items-center px-3 underline"
            >
              {localeNames[code]}
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
