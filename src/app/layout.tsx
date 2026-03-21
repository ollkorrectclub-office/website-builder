import type { Metadata } from "next";

import "@/app/globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ThemeScript } from "@/components/providers/theme-script";

export const metadata: Metadata = {
  title: "Besa Studio",
  description: "Foundation phase for a Balkan-first AI app builder.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
