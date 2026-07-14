"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

/** Flip the `dark` class on <html>. The app defaults to dark (see layout); this lets you switch. */
export function ThemeToggle() {
  const [isDark, setIsDark] = useState(true);

  // Sync initial state from the class the server rendered, avoiding a hydration mismatch.
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !isDark;
    document.documentElement.classList.toggle("dark", next);
    setIsDark(next);
  }

  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
      {isDark ? <Sun /> : <Moon />}
    </Button>
  );
}
