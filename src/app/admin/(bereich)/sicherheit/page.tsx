import Link from "next/link";
import QRCode from "qrcode";
import { authenticator } from "otplib";
import { requireAdmin } from "@/modules/auth/guards";
import { startTotpSetup } from "@/modules/auth/actions";
import { decrypt } from "@/lib/crypto";
import { getSettings } from "@/modules/admin/settings";
import { ConfirmTotpForm, DisableTotpForm } from "./TotpForms";

export const metadata = { title: "Mein Zugang" };

export default async function Sicherheit() {
  const { employee } = await requireAdmin({ allowMissing2fa: true });
  let qr: string | null = null;
  let secret: string | null = null;
  if (!employee.totpEnabled && employee.totpSecretEnc) {
    secret = decrypt(employee.totpSecretEnc);
    const uri = authenticator.keyuri(employee.loginName ?? employee.personnelNo, "Autoklinik Bludau Zeit", secret);
    qr = await QRCode.toDataURL(uri, { margin: 1, width: 260 });
  }
  return (
    <div className="flex max-w-xl flex-col gap-5">
      <h1 className="text-3xl font-extrabold">Mein Zugang</h1>
      {!employee.totpEnabled && (await getSettings()).requireAdmin2fa && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 font-semibold text-red-800 ring-2 ring-red-700">Für Admins ist die Zwei-Faktor-Anmeldung vorgeschrieben. Bitte jetzt einrichten – vorher sind die anderen Bereiche gesperrt.</p>
      )}
      <section className="card flex flex-col gap-3">
        <h2 className="text-xl font-bold">Zwei-Faktor-Anmeldung (2FA)</h2>
        {employee.totpEnabled ? (
          <>
            <p className="font-semibold text-green-800">✔ Aktiv. Bei jeder Anmeldung wird zusätzlich ein Code aus Ihrer Authenticator-App abgefragt.</p>
            <DisableTotpForm />
          </>
        ) : qr && secret ? (
          <>
            <ol className="list-decimal space-y-1 pl-5">
              <li>Authenticator-App auf dem Handy öffnen (z. B. „Google Authenticator“, „Microsoft Authenticator“ oder „2FAS“).</li>
              <li>„Konto hinzufügen“ → „QR-Code scannen“ und diesen Code scannen:</li>
            </ol>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR-Code für die Authenticator-App" width={260} height={260} className="self-center rounded-lg ring-1 ring-blau-900/20" />
            <p className="text-sm">Falls Scannen nicht geht, diesen Schlüssel eintippen: <code className="break-all rounded bg-blau-50 px-1 font-mono">{secret}</code></p>
            <p>3. Den 6-stelligen Code aus der App hier eingeben:</p>
            <ConfirmTotpForm />
          </>
        ) : (
          <>
            <p>Schützt Ihren Admin-Zugang zusätzlich, falls jemand Ihr Passwort erfährt.</p>
            <form action={startTotpSetup}><button className="btn btn-primary">2FA einrichten</button></form>
          </>
        )}
      </section>
      <section className="card flex flex-col gap-3">
        <h2 className="text-xl font-bold">Passwort</h2>
        <Link href="/admin/passwort-aendern" className="btn btn-ghost">Passwort ändern</Link>
      </section>
    </div>
  );
}
