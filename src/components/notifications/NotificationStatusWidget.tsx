'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Bell, BellOff, BellRing, Check, AlertTriangle, XCircle, Send, RefreshCw } from 'lucide-react';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function NotificationStatusWidget() {
  const [supported, setSupported] = useState<boolean>(true);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [testing, setTesting] = useState<boolean>(false);
  const [message, setMessage] = useState<string | null>(null);

  // Check current browser permission and subscription status
  const checkStatus = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
      setSupported(false);
      return;
    }

    const currentPermission = Notification.permission;
    setPermission(currentPermission);

    if (currentPermission === 'granted') {
      try {
        const registration = await navigator.serviceWorker.ready;
        const sub = await registration.pushManager.getSubscription();
        setIsSubscribed(!!sub);
      } catch (err) {
        console.warn('[PUSH] Error checking existing subscription:', err);
        setIsSubscribed(false);
      }
    } else {
      setIsSubscribed(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Subscribe browser to push
  const handleEnableNotifications = async () => {
    if (!supported) {
      alert('Web Push is not supported in this browser environment.');
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      // 1. Request browser permission
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result !== 'granted') {
        if (result === 'denied') {
          setMessage('Notifications are blocked in Chrome site settings.');
        }
        setLoading(false);
        return;
      }

      // 2. Register Service Worker if not already registered
      let reg: ServiceWorkerRegistration;
      try {
        reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        await navigator.serviceWorker.ready;
      } catch (swErr: any) {
        console.error('[PUSH] Service Worker registration failed:', swErr);
        throw new Error('Service Worker registration failed: ' + swErr.message);
      }

      // 3. Fetch VAPID Public Key
      let vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        const res = await fetch('/api/notifications/vapid-public-key');
        const json = await res.json();
        if (!json.success || !json.vapidPublicKey) {
          throw new Error('Could not retrieve VAPID public key from server');
        }
        vapidPublicKey = json.vapidPublicKey;
      }

      // 4. Subscribe via PushManager
      const convertedKey = urlBase64ToUint8Array(vapidPublicKey!);
      const existingSub = await reg.pushManager.getSubscription();
      let sub = existingSub;

      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedKey as BufferSource,
        });
      }

      // 5. Send subscription to CRM server
      const saveRes = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });

      if (!saveRes.ok) {
        const errJson = await saveRes.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to save subscription on server');
      }

      setIsSubscribed(true);
      setMessage('✓ Notifications enabled successfully!');
      setTimeout(() => setMessage(null), 4000);
    } catch (err: any) {
      console.error('[PUSH] Enable notifications error:', err);
      setMessage(`✕ Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Direct test push
  const handleTestPush = async () => {
    setTesting(true);
    setMessage(null);

    try {
      const res = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Test notification failed');
      }

      if (json.sent > 0) {
        setMessage('✓ Test push sent to Chrome!');
      } else {
        setMessage('⚠ Server reported 0 active browser subscriptions.');
      }
      setTimeout(() => setMessage(null), 4000);
    } catch (err: any) {
      setMessage(`✕ Test failed: ${err.message}`);
    } finally {
      setTesting(false);
    }
  };

  if (!supported) {
    return (
      <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-[#141416] border border-[#242428] rounded-xs text-[#71717a] font-mono text-[10px]">
        <BellOff className="w-3 h-3" />
        <span>PUSH NOT SUPPORTED</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {/* Status Pill */}
      {permission === 'granted' && isSubscribed ? (
        <div className="flex items-center gap-2 px-2.5 py-1 bg-[#00d664]/10 border border-[#00d664]/30 rounded-xs">
          <Check className="w-3 h-3 text-[#00d664]" />
          <span className="font-mono text-[10px] uppercase font-bold text-[#00d664] tracking-wider hidden sm:inline">
            Browser Notifications: ✓ Enabled
          </span>
          <span className="font-mono text-[10px] uppercase font-bold text-[#00d664] tracking-wider sm:hidden">
            ✓ Push On
          </span>
          <button
            type="button"
            onClick={handleTestPush}
            disabled={testing}
            title="Send test Chrome notification"
            className="ml-1 text-[9px] font-mono text-white/80 hover:text-white bg-[#00d664]/20 hover:bg-[#00d664]/30 px-1.5 py-0.5 rounded-none transition-colors cursor-pointer flex items-center gap-1"
          >
            {testing ? (
              <RefreshCw className="w-2.5 h-2.5 animate-spin" />
            ) : (
              <Send className="w-2.5 h-2.5" />
            )}
            <span className="hidden md:inline">Test Push</span>
          </button>
        </div>
      ) : permission === 'denied' ? (
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 bg-[#ff3e00]/10 border border-[#ff3e00]/30 rounded-xs text-[#ff3e00]"
          title="Notifications are blocked in Chrome site settings. Click the lock/settings icon next to URL in Chrome to allow notifications."
        >
          <XCircle className="w-3 h-3 shrink-0" />
          <span className="font-mono text-[10px] uppercase font-bold tracking-wider">
            Browser Notifications: ✕ Notifications blocked
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 rounded-xs text-amber-400">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          <span className="font-mono text-[10px] uppercase font-bold tracking-wider hidden sm:inline">
            Browser Notifications: ⚠ Permission required
          </span>
          <span className="font-mono text-[10px] uppercase font-bold tracking-wider sm:hidden">
            ⚠ Push Required
          </span>
          <button
            type="button"
            onClick={handleEnableNotifications}
            disabled={loading}
            className="ml-1 text-[9px] font-mono font-bold text-black bg-amber-400 hover:bg-amber-300 px-2 py-0.5 rounded-none transition-colors cursor-pointer flex items-center gap-1"
          >
            {loading ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : <Bell className="w-2.5 h-2.5" />}
            <span>Enable</span>
          </button>
        </div>
      )}

      {/* Ephemeral Feedback Message */}
      {message && (
        <span className="font-mono text-[10px] text-zinc-300 animate-fade-in truncate max-w-xs">
          {message}
        </span>
      )}
    </div>
  );
}
