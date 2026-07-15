const localeUrl = new URL("../../../shared/_locales/en/messages.json", import.meta.url);

async function readCanonicalLocale() {
  if (localeUrl.protocol === "file:") {
    const { readFile } = await import("node:fs/promises");
    return JSON.parse(await readFile(localeUrl, "utf8"));
  }

  const response = await fetch(localeUrl);
  if (!response.ok) {
    throw new Error(`Unable to load canonical English locale: ${response.status}`);
  }
  return response.json();
}

const locale = await readCanonicalLocale();

export const EN_MESSAGES = Object.freeze(Object.fromEntries(
  Object.entries(locale).map(([key, entry]) => [key, entry.message])
));
