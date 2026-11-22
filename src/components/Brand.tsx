import Image from "next/image";

/** Firmenlogo (lokal ausgeliefert, keine externen Ressourcen) */
export function Logo({ height = 44, className = "" }: { height?: number; className?: string }) {
  return (
    <span className={`inline-flex rounded-xl bg-white p-1 ${className}`}>
      <Image src="/logo.jpg" alt="Bludau – Die Auto-Klinik" width={Math.round(height * 1.455)} height={height} unoptimized priority />
    </span>
  );
}

export function Brand({ subtitle }: { subtitle?: string }) {
  return (
    <div className="flex items-center gap-3">
      <Logo />
      {subtitle && <div className="text-base font-bold leading-tight">{subtitle}</div>}
    </div>
  );
}
