import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { redirectIfAuthenticated } from "@/lib/auth/actions";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/locales";

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale } = await params;
  const { next } = await searchParams;
  await redirectIfAuthenticated(locale);
  const dictionary = getDictionary(locale);

  return (
    <AuthShell
      locale={locale as Locale}
      dictionary={dictionary}
      title={dictionary.auth.loginTitle}
      copy={dictionary.auth.loginCopy}
    >
      <LoginForm locale={locale as Locale} dictionary={dictionary} nextPath={typeof next === "string" ? next : null} />
    </AuthShell>
  );
}
