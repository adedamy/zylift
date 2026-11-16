// Safe in-app toast notification helper that avoids window.alert() in iframe sandboxes

export type ToastType = 'success' | 'info' | 'warning' | 'error';

interface ToastEventDetail {
  message: string;
  type: ToastType;
  duration?: number;
}

export function showToast(message: string, type: ToastType = 'success', duration = 3000): void {
  if (typeof window !== 'undefined') {
    const event = new CustomEvent<ToastEventDetail>('zylift:toast', {
      detail: { message, type, duration },
    });
    window.dispatchEvent(event);
  }
}
