'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Bell, Check, Clock, AlertTriangle, ShieldAlert, Info } from 'lucide-react';
import { Notification } from '../lib/types';
import { getNotifications, markNotificationRead } from '../lib/api';
import { formatDate } from '../lib/utils';

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifs = async () => {
    try {
      const res = await getNotifications();
      if (res.data) {
        setNotifications(res.data);
      }
    } catch (err) {
      console.warn('Failed to fetch notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 15000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await markNotificationRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        type="button"
        className="relative p-2 rounded-lg bg-gov-blue-950/80 hover:bg-white/10 text-blue-200 hover:text-white border border-white/20 transition-colors"
        aria-label="View notifications"
        title="Compliance & Expiry Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white font-bold text-[10px] w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50 text-slate-800">
          <div className="p-3 bg-gov-blue-900 text-white border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-gov-saffron" />
              <span className="font-bold text-xs uppercase tracking-wider">
                System Alerts & Expiry
              </span>
            </div>
            <span className="text-[11px] text-blue-200">
              {unreadCount} unread
            </span>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No active notifications or compliance alerts.
              </div>
            ) : (
              notifications.map((n) => {
                const isOverdue = n.type === 'OVERDUE';
                const isWarning = n.type === 'WARNING';

                return (
                  <div
                    key={n.id}
                    className={`p-3 text-xs transition-colors flex items-start justify-between gap-3 ${
                      !n.read ? 'bg-blue-50/50 hover:bg-blue-50' : 'hover:bg-slate-50 opacity-75'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 flex-1">
                      <div className="mt-0.5 flex-shrink-0">
                        {isOverdue ? (
                          <ShieldAlert className="w-4 h-4 text-red-600" />
                        ) : isWarning ? (
                          <AlertTriangle className="w-4 h-4 text-amber-500" />
                        ) : (
                          <Info className="w-4 h-4 text-blue-500" />
                        )}
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-bold ${
                              isOverdue
                                ? 'text-red-700'
                                : isWarning
                                ? 'text-amber-800'
                                : 'text-slate-800'
                            }`}
                          >
                            {n.title}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          {n.message}
                        </p>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 pt-1">
                          <Clock className="w-3 h-3" />
                          <span>{formatDate(n.createdAt)}</span>
                        </div>
                      </div>
                    </div>

                    {!n.read && (
                      <button
                        onClick={(e) => handleMarkAsRead(n.id, e)}
                        type="button"
                        className="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
                        title="Mark as read"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
