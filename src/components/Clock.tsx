"use client";

import { useEffect, useState } from "react";

const timeFmt = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", second: "2-digit" });
const dateFmt = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", weekday: "long", day: "numeric", month: "long", year: "numeric" });

/** Große Uhr in Berliner Zeit; gleicht eine falsch gehende Geräteuhr mit der Serverzeit ab */
export function Clock({ serverNow, className = "" }: { serverNow: number; className?: string }) {
  const [offset] = useState(() => serverNow - Date.now());
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now() + offset);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [offset]);
  const d = new Date(now ?? serverNow);
  return (
    <div className={className}>
      <div className="font-black tabular-nums tracking-tight" suppressHydrationWarning>{timeFmt.format(d)}</div>
      <div className="text-xl font-semibold opacity-90" suppressHydrationWarning>{dateFmt.format(d)}</div>
    </div>
  );
}
