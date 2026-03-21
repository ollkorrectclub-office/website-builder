import { dictionaries, type Dictionary } from "@/lib/i18n/dictionaries";
import { defaultLocale, isLocale, type Locale } from "@/lib/i18n/locales";

export function getDictionary(locale: string): Dictionary {
  if (!isLocale(locale)) {
    return dictionaries[defaultLocale];
  }

  return dictionaries[locale as Locale];
}
