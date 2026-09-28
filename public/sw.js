// Service Worker v1.1.0 - Chrome Web Push & Deep-Link Navigation for Dr. Debuggers CRM

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Handle incoming Web Push notifications
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { title: 'Dr. Debuggers CRM', body: event.data.text() };
    }
  }

  const title = data.title || 'Dr. Debuggers CRM';
  const options = {
    body: data.body || 'New message received',
    icon: data.icon || '/globe.svg',
    badge: data.badge || '/globe.svg',
    data: data.data || {},
    vibrate: [100, 50, 100],
    requireInteraction: true,
    tag: data.data?.conversationId || 'crm-chat-notification',
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Handle notification click: focus existing CRM window or open chat
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const rawUrl = event.notification?.data?.url || '/dashboard/team';
  const targetUrl = new URL(rawUrl, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) {
            return client.navigate(targetUrl);
          }
          return client;
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }

      return undefined;
    })
  );
});
