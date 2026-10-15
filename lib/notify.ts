/**
 * App-wide toast from any component, without prop drilling.
 * The page listens for "app-toast" events and shows them in its toast.
 */
export type ToastTone = "error" | "info" | "success";

export function notify(text: string, tone: ToastTone = "error") {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("app-toast", { detail: { text, tone } }));
}

/** fetch() that reports failures (server message or `failMessage`) and returns whether it succeeded. */
export async function checkedFetch(url: string, init: RequestInit, failMessage: string): Promise<boolean> {
  try {
    const res = await fetch(url, init);
    if (res.ok) return true;
    const body = await res.json().catch(() => ({}));
    notify(typeof body?.error === "string" && body.error.length < 200 ? body.error : failMessage);
    return false;
  } catch {
    notify(`${failMessage} Check your connection.`);
    return false;
  }
}

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  /** Red confirm button for actions that delete or sign out */
  destructive?: boolean;
}

/** In-app confirmation sheet (rendered by <ConfirmHost />); resolves true when confirmed. */
export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  return new Promise((resolve) => window.dispatchEvent(new CustomEvent("app-confirm", { detail: { ...options, resolve } })));
}
