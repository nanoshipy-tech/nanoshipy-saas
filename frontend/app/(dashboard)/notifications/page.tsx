'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bell, CheckSquare, RefreshCw, MessageSquare, Package, AlertTriangle,
  Clock, ExternalLink, CheckCircle2, ChevronLeft, ChevronRight, Filter, Search
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/apiClient';
import { Spinner } from '@/components/ui/Spinner';

export interface InAppNotification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  link_url: string | null;
  is_read: boolean;
  metadata: any;
  created_at: string;
}

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
    return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function getNotificationCategory(title: string, body: string): 'ticket' | 'order' | 'alert' | 'system' {
  const text = (title + ' ' + body).toLowerCase();
  if (text.includes('ticket') || text.includes('reply') || text.includes('support')) return 'ticket';
  if (text.includes('order') || text.includes('shipment') || text.includes('package') || text.includes('awb')) return 'order';
  if (text.includes('urgent') || text.includes('warning') || text.includes('ndr') || text.includes('breach') || text.includes('hold')) return 'alert';
  return 'system';
}

function getNotificationIcon(category: 'ticket' | 'order' | 'alert' | 'system') {
  switch (category) {
    case 'ticket':
      return <MessageSquare className="w-5 h-5 text-[#8410DC]" />;
    case 'order':
      return <Package className="w-5 h-5 text-emerald-600" />;
    case 'alert':
      return <AlertTriangle className="w-5 h-5 text-amber-500" />;
    default:
      return <Bell className="w-5 h-5 text-[#8410DC]" />;
  }
}

export default function NotificationsInboxPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  // Filters & Pagination
  const [filterTab, setFilterTab] = useState<'all' | 'unread' | 'read'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 15;

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await apiClient.get('/notifications/unread-count');
      if (res.data?.success) {
        setUnreadCount(res.data.data.unread_count || 0);
      }
    } catch {}
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, any> = { page, limit };
      if (filterTab === 'unread') params.is_read = 'false';
      if (filterTab === 'read') params.is_read = 'true';

      const res = await apiClient.get('/notifications', { params });
      if (res.data?.success) {
        setNotifications(res.data.data.notifications || []);
        setTotalCount(res.data.data.pagination?.total || 0);
      }
    } catch (err: any) {
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [page, filterTab]);

  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
  }, [fetchNotifications, fetchUnreadCount]);

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await apiClient.put(`/notifications/${id}/read`);
      if (res.data?.success) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        setUnreadCount(c => Math.max(0, c - 1));
      }
    } catch {
      toast.error('Failed to mark notification as read');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      setMarkingAll(true);
      const res = await apiClient.put('/notifications/mark-all-read');
      if (res.data?.success) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
        toast.success('All notifications marked as read');
      }
    } catch {
      toast.error('Failed to mark all as read');
    } finally {
      setMarkingAll(false);
    }
  };

  const handleCardClick = (notif: InAppNotification) => {
    if (!notif.is_read) {
      handleMarkAsRead(notif.id);
    }
    if (notif.link_url) {
      router.push(notif.link_url);
    }
  };

  const filteredNotifications = notifications.filter(n => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q);
  });

  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[#14121F] tracking-tight">Notification Center</h1>
            {unreadCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#8410DC]/10 text-[#8410DC] border border-[#8410DC]/20 animate-pulse">
                {unreadCount} unread
              </span>
            )}
          </div>
          <p className="text-xs text-[#7E7994] mt-0.5">
            Stay informed on ticket replies, shipment milestones, orders, and system exceptions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              disabled={markingAll}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-[#E8DEF2] hover:bg-[#F6EFFF] text-[#5B069A] transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>{markingAll ? 'Updating...' : 'Mark all as read'}</span>
            </button>
          )}

          <button
            onClick={() => { fetchNotifications(); fetchUnreadCount(); }}
            className="p-2 rounded-xl text-[#534F66] bg-white border border-[#E8DEF2] hover:bg-[#F6EFFF] transition shadow-xs cursor-pointer"
            title="Refresh notifications"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <Link
            href="/settings/notifications"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-[#E8DEF2] hover:bg-[#F6EFFF] text-[#534F66] transition shadow-xs"
          >
            Preferences
          </Link>
        </div>
      </div>

      {/* Tabs & Search controls */}
      <div className="bg-white rounded-2xl border border-[#E8DEF2] p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-1.5 bg-[#F8F7FD] p-1 rounded-xl">
          <button
            onClick={() => { setFilterTab('all'); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filterTab === 'all'
                ? 'bg-white text-[#5B069A] shadow-xs'
                : 'text-[#7E7994] hover:text-[#14121F]'
            }`}
          >
            All ({totalCount})
          </button>
          <button
            onClick={() => { setFilterTab('unread'); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filterTab === 'unread'
                ? 'bg-white text-[#5B069A] shadow-xs'
                : 'text-[#7E7994] hover:text-[#14121F]'
            }`}
          >
            Unread ({unreadCount})
          </button>
          <button
            onClick={() => { setFilterTab('read'); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filterTab === 'read'
                ? 'bg-white text-[#5B069A] shadow-xs'
                : 'text-[#7E7994] hover:text-[#14121F]'
            }`}
          >
            Read
          </button>
        </div>

        <div className="relative flex-1 sm:max-w-xs">
          <Search className="w-3.5 h-3.5 text-[#7E7994] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notifications..."
            className="w-full pl-8 pr-3 py-1.5 bg-[#F8F7FD] border border-transparent focus:border-[#8410DC] rounded-xl text-xs text-[#14121F] outline-none transition"
          />
        </div>
      </div>

      {/* Notifications List */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <Spinner className="w-8 h-8 text-[#8410DC]" />
          <p className="text-xs text-[#7E7994] font-medium">Loading notifications inbox...</p>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="py-20 bg-white rounded-2xl border border-[#E8DEF2] flex flex-col items-center justify-center text-center p-6 shadow-xs">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-3 stroke-[1.5]" />
          <h3 className="text-sm font-bold text-[#14121F]">
            {filterTab === 'unread' ? 'No unread notifications' : 'No notifications found'}
          </h3>
          <p className="text-xs text-[#7E7994] mt-1 max-w-sm">
            {filterTab === 'unread'
              ? 'You are all caught up! New alerts on shipments, ticket replies, and orders will appear here.'
              : 'There are no notifications matching your current filters.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E8DEF2] divide-y divide-[#F2ECF7] overflow-hidden shadow-xs">
          {filteredNotifications.map((notif) => {
            const category = getNotificationCategory(notif.title, notif.body);
            return (
              <div
                key={notif.id}
                onClick={() => handleCardClick(notif)}
                className={`p-4 sm:p-5 flex items-start gap-4 transition-all duration-150 cursor-pointer ${
                  notif.is_read
                    ? 'hover:bg-[#F8F7FD] opacity-85 hover:opacity-100'
                    : 'bg-[#8410DC]/[0.03] hover:bg-[#8410DC]/[0.06] border-l-4 border-[#8410DC]'
                }`}
              >
                {/* Category Icon */}
                <div className="w-10 h-10 rounded-xl bg-white border border-[#E8DEF2] flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                  {getNotificationIcon(category)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className={`text-sm leading-snug font-bold ${notif.is_read ? 'text-[#14121F]' : 'text-[#14121F]'}`}>
                        {notif.title}
                      </h4>
                      {!notif.is_read && (
                        <span className="w-2 h-2 rounded-full bg-[#8410DC] shrink-0 animate-pulse" />
                      )}
                    </div>
                    <span className="text-[11px] font-medium text-[#7E7994] shrink-0 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatRelativeTime(notif.created_at)}
                    </span>
                  </div>

                  <p className="text-xs text-[#534F66] leading-relaxed font-normal">
                    {notif.body}
                  </p>

                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-[#F2ECF7]/60 text-xs">
                    <div>
                      {notif.link_url && (
                        <span className="inline-flex items-center gap-1 font-semibold text-[#8410DC] hover:underline">
                          View details
                          <ExternalLink className="w-3 h-3" />
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-[#A49EBA]">
                        {new Date(notif.created_at).toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>

                      {!notif.is_read && (
                        <button
                          type="button"
                          onClick={(e) => handleMarkAsRead(notif.id, e)}
                          className="text-[11px] font-semibold text-[#5B069A] hover:text-[#8410DC] hover:underline"
                        >
                          Mark as read
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-white rounded-2xl border border-[#E8DEF2] px-5 py-3 flex items-center justify-between shadow-xs">
          <p className="text-xs text-[#534F66]">
            Showing page <span className="font-bold text-[#14121F]">{page}</span> of{' '}
            <span className="font-bold text-[#14121F]">{totalPages}</span>
          </p>

          <div className="flex items-center gap-1.5">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="p-1.5 rounded-lg border border-[#E8DEF2] text-[#534F66] hover:bg-[#F8F7FD] disabled:opacity-40 transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="p-1.5 rounded-lg border border-[#E8DEF2] text-[#534F66] hover:bg-[#F8F7FD] disabled:opacity-40 transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
