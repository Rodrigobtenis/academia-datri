import { useEffect, useState } from "react";
import { dismiss, subscribe, type ToastMessage } from "../lib/toast-bus";

export function Toaster() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const unsubscribe = subscribe(setToasts);
    return unsubscribe;
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`rounded-lg shadow-lg px-4 py-3 text-sm text-white flex items-start justify-between gap-3 ${
            t.type === "error" ? "bg-red-600" : "bg-emerald-600"
          }`}
        >
          <span>{t.text}</span>
          <button onClick={() => dismiss(t.id)} className="text-white/80 hover:text-white shrink-0">
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
