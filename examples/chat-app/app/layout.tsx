import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "skein-js · research assistant",
  description:
    "A Gemini research assistant (thinking + web search + long-term memory) served by skein-js.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // Default to dark; ThemeToggle flips the class. suppressHydrationWarning: the class may change on
  // the client before React hydrates.
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">{children}</body>
    </html>
  );
}
