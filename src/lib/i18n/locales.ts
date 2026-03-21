export const locales = ["sq", "en"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "sq";

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

export function swapLocaleInPath(pathname: string, locale: Locale) {
  const segments = pathname.split("/");

  if (segments.length > 1 && isLocale(segments[1] ?? "")) {
    segments[1] = locale;
    return segments.join("/") || "/";
  }

  return `/${locale}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}
