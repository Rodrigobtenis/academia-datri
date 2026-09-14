// Pub-sub minimalista para poder emitir toasts desde fuera de React (el mutationCache
// de TanStack Query vive a nivel de módulo, no dentro del árbol de componentes).
export interface ToastMessage {
  id: number;
  type: "error" | "success";
  text: string;
}

type Listener = (toasts: ToastMessage[]) => void;

let toasts: ToastMessage[] = [];
let nextId = 1;
const listeners = new Set<Listener>();

function notify() {
  for (const l of listeners) l([...toasts]);
}

export function subscribe(listener: Listener) {
  listeners.add(listener);
  listener([...toasts]);
  return () => {
    listeners.delete(listener);
  };
}

function push(type: ToastMessage["type"], text: string) {
  const id = nextId++;
  toasts = [...toasts, { id, type, text }];
  notify();
  setTimeout(() => dismiss(id), 5000);
}

export function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  notify();
}

export function emitError(text: string) {
  push("error", text);
}

export function emitSuccess(text: string) {
  push("success", text);
}
