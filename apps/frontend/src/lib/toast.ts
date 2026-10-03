export interface ToastItem {
  id: string;
  type: "success" | "error" | "info";
  message: string;
  title?: string;
  durationMs: number;
}

type ToastListener = (toasts: ToastItem[]) => void;

export class ToastService {
  private toasts: ToastItem[] = [];
  private listeners: Set<ToastListener> = new Set();
  private nextId = 0;

  public subscribe(listener: ToastListener): () => void {
    this.listeners.add(listener);
    listener([...this.toasts]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const snapshot = [...this.toasts];
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  public show(params: {
    type: "success" | "error" | "info";
    message: string;
    title?: string;
    durationMs?: number;
  }): string {
    const id = String(++this.nextId);
    const durationMs = params.durationMs ?? (params.type === "error" ? 8000 : 4000);
    const item: ToastItem = {
      id,
      type: params.type,
      message: params.message,
      title: params.title,
      durationMs
    };
    this.toasts = [...this.toasts, item];
    this.notify();

    if (durationMs > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, durationMs);
    }

    return id;
  }

  public success(message: string, title?: string): string {
    return this.show({ type: "success", message, title, durationMs: 4000 });
  }

  public error(message: string, title?: string): string {
    return this.show({ type: "error", message, title, durationMs: 8000 });
  }

  public info(message: string, title?: string): string {
    return this.show({ type: "info", message, title, durationMs: 5000 });
  }

  public dismiss(id: string): void {
    const initialLength = this.toasts.length;
    this.toasts = this.toasts.filter((item) => item.id !== id);
    if (this.toasts.length !== initialLength) {
      this.notify();
    }
  }

  public getToasts(): ToastItem[] {
    return [...this.toasts];
  }
}

export const toast = new ToastService();
