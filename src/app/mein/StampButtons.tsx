"use client";

import { useState, useTransition } from "react";
import { stampPersonal } from "@/modules/zeiterfassung/personal-actions";
import { STAMP_LABEL, type StampType } from "@/modules/zeiterfassung/rules";
import { FormMessage } from "@/components/FormMessage";

const STYLE: Record<StampType, string> = {
  KOMMEN: "bg-green-600 text-white hover:bg-green-500",
  PAUSE_START: "bg-gelb-500 text-blau-950 hover:bg-gelb-400",
  PAUSE_ENDE: "bg-blau-700 text-white hover:bg-blau-600",
  GEHEN: "bg-red-700 text-white hover:bg-red-600",
};

export function StampButtons({ allowed }: { allowed: StampType[] }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok?: string; error?: string; notice?: string }>();
  return (
    <div className="flex flex-col gap-3">
      <FormMessage state={msg} />
      {msg?.notice && <p className="rounded-xl bg-gelb-100 p-3 font-semibold ring-2 ring-gelb-500">{msg.notice}</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {allowed.map((t) => (
          <button key={t} type="button" disabled={pending}
            onClick={() => start(async () => setMsg(await stampPersonal(t, crypto.randomUUID())))}
            className={`btn min-h-20 text-2xl ${STYLE[t]}`}>
            {STAMP_LABEL[t]}
          </button>
        ))}
      </div>
    </div>
  );
}
