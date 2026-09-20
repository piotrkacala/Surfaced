const LOCALES = Object.freeze(["en", "pl", "fr"]);

async function readLocale(locale) {
  const localeUrl = new URL(`../../../shared/_locales/${locale}/messages.json`, import.meta.url);
  if (localeUrl.protocol === "file:") {
    const { readFile } = await import("node:fs/promises");
    return JSON.parse(await readFile(localeUrl, "utf8"));
  }

  const response = await fetch(localeUrl);
  if (!response.ok) {
    throw new Error(`Unable to load ${locale} locale: ${response.status}`);
  }
  return response.json();
}

const localeEntries = await Promise.all(LOCALES.map(async (locale) => {
  const messages = await readLocale(locale);
  return [locale, Object.freeze(Object.fromEntries(
    Object.entries(messages).map(([key, entry]) => [key, entry.message])
  ))];
}));

export const MESSAGES_BY_LOCALE = Object.freeze(Object.fromEntries(localeEntries));
export const EN_MESSAGES = MESSAGES_BY_LOCALE.en;

export function getMessages(locale = "en") {
  const language = String(locale).toLowerCase().split(/[-_]/, 1)[0];
  return MESSAGES_BY_LOCALE[language] || EN_MESSAGES;
}
