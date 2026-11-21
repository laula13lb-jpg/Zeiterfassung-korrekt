import { requireEmployee } from "@/modules/auth/guards";
import { ChangePinForm } from "@/app/anmelden/pin-aendern/ChangePinForm";

export const metadata = { title: "PIN ändern" };

export default async function MeinPin() {
  await requireEmployee();
  return (
    <div className="flex max-w-md flex-col gap-5">
      <h1 className="text-3xl font-extrabold">PIN ändern</h1>
      <ChangePinForm />
    </div>
  );
}
