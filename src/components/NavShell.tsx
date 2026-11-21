import Link from "next/link";
import { Brand } from "./Brand";

export type NavItem = { href: string; label: string; soon?: boolean };

/** Kopfzeile + Navigation (mobil: horizontal scrollbar; Desktop: Seitenleiste) */
export function NavShell({ title, user, items, logout, children }: {
  title: string;
  user: string;
  items: NavItem[];
  logout: () => Promise<void>;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="bg-blau-800 text-white lg:min-h-dvh">
        <div className="flex items-center justify-between gap-3 p-4">
          <Brand subtitle={title} />
          <form action={logout} className="lg:hidden">
            <button className="btn min-h-11 bg-gelb-500 px-4 text-base text-blau-950">Abmelden</button>
          </form>
        </div>
        <nav aria-label="Hauptmenü" className="flex gap-2 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible">
          {items.map((i) => (
            <Link key={i.href} href={i.href}
              className="flex min-h-12 shrink-0 items-center gap-2 rounded-xl px-4 font-semibold text-white hover:bg-blau-700 focus-visible:outline-4 focus-visible:outline-gelb-500">
              {i.label}
              {i.soon && <span className="rounded bg-gelb-500 px-1.5 text-xs font-bold text-blau-950">bald</span>}
            </Link>
          ))}
        </nav>
        <div className="hidden p-4 lg:block">
          <div className="mb-3 text-sm opacity-80">Angemeldet: {user}</div>
          <form action={logout}><button className="btn w-full bg-gelb-500 text-blau-950">Abmelden</button></form>
        </div>
      </aside>
      <main className="mx-auto w-full max-w-5xl p-4 sm:p-6">{children}</main>
    </div>
  );
}
