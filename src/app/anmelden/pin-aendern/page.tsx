import { requireEmployee } from "@/modules/auth/guards";
import { Brand } from "@/components/Brand";
import { ChangePinForm } from "./ChangePinForm";

export const metadata = { title: "PIN ändern" };

export default async function PinAendernPage() {
  const emp = await requireEmployee({ allowPinChange: true });
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-4 sm:p-6">
      <header className="rounded-2xl bg-blau-800 p-4 text-white"><Brand subtitle="PIN ändern" /></header>
      {emp.pinMustChange && (
        <p className="rounded-xl bg-gelb-100 p-4 font-semibold ring-2 ring-gelb-500">
          Bitte lege jetzt deine eigene PIN fest. Die Start-PIN vom Büro gilt danach nicht mehr.
        </p>
      )}
      <ChangePinForm />
      <ul className="list-disc pl-5 text-sm text-blau-900/80">
        <li>4 bis 6 Ziffern</li>
        <li>keine einfachen Folgen wie 1234 oder 0000</li>
        <li>keine Jahreszahl oder dein Geburtsdatum</li>
        <li>PIN niemandem verraten</li>
      </ul>
    </main>
  );
}
