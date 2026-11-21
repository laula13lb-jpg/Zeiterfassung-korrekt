export function ComingSoon({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-extrabold">{title}</h1>
      <div className="card border-l-8 border-gelb-500">
        <p className="text-lg">{text}</p>
      </div>
    </div>
  );
}
