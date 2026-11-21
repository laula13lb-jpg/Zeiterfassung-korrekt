"use client";

import { startTransition } from "react";

/**
 * Formular für Server-Aktionen, das eingegebene Werte bei einer Fehlermeldung
 * NICHT zurücksetzt (React setzt <form action> sonst automatisch zurück).
 */
export function KeepForm({ action, children, className }: {
  action: (fd: FormData) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
    >
      {children}
    </form>
  );
}
