"use server";

import { redirect } from "next/navigation";

import { hashPassword } from "@/lib/auth/password";
import {
  createPasswordUser,
  getCurrentAuthenticatedUser,
  signInUserWithPassword,
  signOutCurrentUser,
} from "@/lib/auth/repository";
import type { FormState } from "@/lib/workspaces/form-state";

function nextDestination(locale: string, nextPath?: string | null, fallback?: string) {
  if (nextPath && nextPath.startsWith(`/${locale}/`)) {
    return nextPath;
  }

  return fallback ?? `/${locale}/app/workspaces`;
}

function localized(locale: string, sq: string, en: string) {
  return locale === "sq" ? sq : en;
}

export async function loginAction(
  locale: string,
  nextPath: string | null,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return {
      status: "error",
      message: localized(locale, "Ju lutem shkruani email-in dhe fjalëkalimin.", "Please enter your email and password."),
    };
  }

  try {
    await signInUserWithPassword(email, password);
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : localized(locale, "Kyqja dështoi.", "Sign-in failed."),
    };
  }

  redirect(nextDestination(locale, nextPath));
}

export async function signupAction(
  locale: string,
  nextPath: string | null,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const companyName = String(formData.get("companyName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();

  if (!fullName || !companyName || !email || password.length < 8) {
    return {
      status: "error",
      message: localized(
        locale,
        "Ju lutem plotësoni fushat e kërkuara dhe përdorni një fjalëkalim me të paktën 8 karaktere.",
        "Please complete all required fields and use a password with at least 8 characters.",
      ),
    };
  }

  try {
    await createPasswordUser({
      email,
      fullName,
      companyName,
      passwordHash: await hashPassword(password),
    });
    await signInUserWithPassword(email, password);
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : localized(locale, "Krijimi i llogarisë dështoi.", "Account creation failed."),
    };
  }

  redirect(nextDestination(locale, nextPath, `/${locale}/app/workspaces/new`));
}

export async function logoutAction(locale: string) {
  await signOutCurrentUser();
  redirect(`/${locale}/login`);
}

export async function requireAuthenticatedUserOrRedirect(locale: string, nextPath: string) {
  const currentUser = await getCurrentAuthenticatedUser();

  if (!currentUser) {
    redirect(`/${locale}/login?next=${encodeURIComponent(nextPath)}`);
  }

  return currentUser.user;
}

export async function redirectIfAuthenticated(locale: string) {
  const currentUser = await getCurrentAuthenticatedUser();

  if (currentUser) {
    redirect(`/${locale}/app/workspaces`);
  }
}
