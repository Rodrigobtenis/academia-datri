const colors: Record<string, string> = {
  gray: "bg-gray-100 text-gray-700",
  green: "bg-emerald-100 text-emerald-700",
  amber: "bg-amber-100 text-amber-700",
  red: "bg-red-100 text-red-700",
  brand: "bg-brand-100 text-brand-700",
  blue: "bg-blue-100 text-blue-700",
};

export function Badge({ children, color = "gray" }: { children: React.ReactNode; color?: keyof typeof colors }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[color]}`}>
      {children}
    </span>
  );
}
