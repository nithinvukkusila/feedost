// "/" is a static page of four plain links, one per language, that work with JavaScript off.
// The inline script jumps to the right one while the page is parsed (it must not wait for the app
// bundle, so it is not a Client Component or an effect) and saves a deliberate pick.
import { localeNames, locales } from "@/config/locales";
import { JUMP_SCRIPT } from "@/lib/jump-script";

export default function JumpPage() {
  return (
    <main className="p-5">
      <script dangerouslySetInnerHTML={{ __html: JUMP_SCRIPT }} />
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
