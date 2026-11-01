"use client";

/** Whether this browser can show system notifications at all. */
export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  return notificationsSupported() ? Notification.permission : "unsupported";
}

let swReg: Promise<ServiceWorkerRegistration | null> | null = null;

/** Register (once) the tiny service worker used to show notifications. */
export function getServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (swReg) return swReg;
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    swReg = Promise.resolve(null);
    return swReg;
  }
  swReg = navigator.serviceWorker
    .register("/sw.js", { scope: "/" })
    .then(() => navigator.serviceWorker.ready)
    .catch(() => null);
  return swReg;
}

export async function requestNotificationPermission(): Promise<
  NotificationPermission | "unsupported"
> {
  if (!notificationsSupported()) return "unsupported";
  if (Notification.permission !== "default") return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

/**
 * Show a system notification. Prefers the service worker (required on
 * Android, and lets a tap focus the CRM); falls back to the plain
 * constructor on desktop browsers without SW support.
 */
export async function showSystemNotification(opts: {
  title: string;
  body: string;
  url: string;
  tag?: string;
}): Promise<void> {
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  const options: NotificationOptions = {
    body: opts.body,
    tag: opts.tag,
    icon: "/icon",
    badge: "/icon",
    data: { url: opts.url },
  };
  try {
    const reg = await getServiceWorker();
    if (reg) {
      await reg.showNotification(opts.title, options);
      return;
    }
  } catch {
    // fall through
  }
  try {
    const n = new Notification(opts.title, options);
    n.onclick = () => {
      window.focus();
      window.location.href = opts.url;
      n.close();
    };
  } catch {
    // Some mobile browsers throw on the constructor — nothing else to do.
  }
}
