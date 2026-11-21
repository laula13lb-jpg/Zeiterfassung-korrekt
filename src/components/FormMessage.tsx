export function FormMessage({ state }: { state?: { error?: string; ok?: string } }) {
  if (state?.error)
    return (
      <p role="alert" className="rounded-xl border-2 border-red-700 bg-red-50 px-4 py-3 text-base font-semibold text-red-800">
        {state.error}
      </p>
    );
  if (state?.ok)
    return (
      <p role="status" className="rounded-xl border-2 border-green-700 bg-green-50 px-4 py-3 text-base font-semibold text-green-800">
        {state.ok}
      </p>
    );
  return null;
}
