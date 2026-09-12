export default function PagePlaceholder({ title, note }: { title: string; note?: string }) {
  return (
    <div className="p-8">
      <h1 className="text-lg font-semibold text-gray-900 mb-2">{title}</h1>
      <p className="text-sm text-gray-500">{note ?? "Esta sección se construye en una próxima etapa."}</p>
    </div>
  );
}
