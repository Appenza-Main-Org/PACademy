/**
 * Lightweight toast system — Zustand-backed, no dependencies on a library.
 */

import { useEffect } from 'react';
import { create } from 'zustand';

type ToastType = 'success' | 'danger' | 'warning' | 'info';

interface ToastEntry {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastState {
  items: ToastEntry[];
  push: (message: string, type?: ToastType) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

const useToastStore = create<ToastState>((set) => ({
  items: [],
  push: (message, type = 'info') => {
    const id = nextId++;
    set((state) => ({ items: [...state.items, { id, message, type }] }));
    setTimeout(() => set((state) => ({ items: state.items.filter((t) => t.id !== id) })), 3200);
  },
  dismiss: (id) => set((state) => ({ items: state.items.filter((t) => t.id !== id) })),
}));

export function toast(message: string, type: ToastType = 'info'): void {
  useToastStore.getState().push(message, type);
}

export function ToastViewport(): JSX.Element {
  const items = useToastStore((s) => s.items);
  const dismiss = useToastStore((s) => s.dismiss);

  // Cleanup on unmount
  useEffect(() => () => useToastStore.setState({ items: [] }), []);

  return (
    <div className="toast-stack" role="region" aria-label="إشعارات">
      {items.map((t) => (
        <button key={t.id} type="button" className={`toast-item ${t.type}`} onClick={() => dismiss(t.id)}>
          {t.message}
        </button>
      ))}
    </div>
  );
}
