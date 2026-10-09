'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useNotifications, InAppNotificationData } from '../../lib/useNotifications';
import { Bell, CheckSquare, ExternalLink, Clock, MessageSquare, AlertTriangle, Package, CheckCircle2, ChevronRight } from 'lucide-react';

function formatRelativeTime(dateStr: string) {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function getNotificationIcon(title: string, body: string) {
  const text = (title + ' ' + body).toLowerCase();
  if (text.includes('ticket') || text.includes('reply') || text.includes('support')) {
    return <MessageSquare className="w-4 h-4 text-[#8410DC]" />;
  }
  if (text.includes('order') || text.includes('shipment') || text.includes('package')) {
    return <Package className="w-4 h-4 text-emerald-600" />;
  }
  if (text.includes('urgent') || text.includes('warning') || text.includes('ndr') || text.includes('breach')) {
    return <AlertTriangle className="w-4 h-4 text-amber-500" />;
  }
  return <Bell className="w-4 h-4 text-[#8410DC]" />;
}

export function NotificationBell() {
  const router = useRouter();
  const { notifications, unreadCount, markAsRead, markAllRead, fetchNotifications } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = () => {
    if (!isOpen) {
      fetchNotifications();
    }
    setIsOpen(!isOpen);
  };

  const handleCardClick = (notif: InAppNotificationData) => {
    if (!notif.is_read) {
      markAsRead(notif.id);
    }
    if (notif.link_url) {
      setIsOpen(false);
      router.push(notif.link_url);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={handleToggle}
        className="relative p-2 text-slate-500 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-all duration-200 focus:outline-none"
        aria-label="Toggle notifications dropdown"
      >
        <Bell className="w-5 h-5 text-slate-700" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex min-w-[18px] h-[18px] px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white ring-2 ring-white animate-pulse shadow-sm">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2.5 w-80 sm:w-96 rounded-2xl border border-slate-200 bg-white/95 backdrop-blur-xl p-4 shadow-2xl ring-1 ring-black/5 z-50 animate-in fade-in slide-in-from-top-3 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-900 text-sm">Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#8410DC]/10 text-[#8410DC]">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1.5 text-xs text-[#8410DC] hover:text-[#5B069A] font-semibold transition-all outline-none cursor-pointer"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto py-2 divide-y divide-slate-100 scrollbar-thin scrollbar-thumb-slate-200">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2 stroke-[1.5]" />
                <p className="text-xs text-slate-700 font-semibold">All caught up!</p>
                <p className="text-[10px] text-slate-400 mt-0.5">No notifications to display.</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleCardClick(notif)}
                  className={`flex flex-col gap-1 p-3 rounded-xl transition-all duration-200 cursor-pointer ${
                    notif.is_read
                      ? 'hover:bg-slate-50 opacity-80 hover:opacity-100'
                      : 'bg-[#8410DC]/5 hover:bg-[#8410DC]/10 border-l-3 border-[#8410DC]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded-lg bg-white shadow-xs border border-slate-100">
                        {getNotificationIcon(notif.title, notif.body)}
                      </div>
                      <span className={`text-xs font-semibold ${notif.is_read ? 'text-slate-700' : 'text-slate-900'}`}>
                        {notif.title}
                      </span>
                    </div>
                    {!notif.is_read && (
                      <span className="h-2 w-2 mt-1 rounded-full bg-[#8410DC] flex-shrink-0 animate-pulse" />
                    )}
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed font-normal pl-7">
                    {notif.body}
                  </p>
                  
                  <div className="flex items-center justify-between mt-2 pl-7 text-[10px] text-slate-450">
                    <span className="flex items-center gap-1 text-slate-400">
                      <Clock className="w-3 h-3" />
                      {formatRelativeTime(notif.created_at)}
                    </span>
                    {notif.link_url && (
                      <span className="flex items-center gap-1 text-[#8410DC] font-semibold hover:underline">
                        View details
                        <ExternalLink className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Link */}
          <div className="pt-2.5 mt-1 border-t border-slate-100 flex items-center justify-between text-xs">
            <Link
              href="/settings/notifications"
              onClick={() => setIsOpen(false)}
              className="text-slate-500 hover:text-slate-800 text-[11px] font-medium transition-colors"
            >
              Preferences
            </Link>
            <Link
              href="/notifications"
              onClick={() => setIsOpen(false)}
              className="text-[#8410DC] hover:text-[#5B069A] font-bold text-xs flex items-center gap-1 transition-colors"
            >
              <span>View all notifications</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
