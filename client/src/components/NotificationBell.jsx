import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch, formatDate } from '../utils/api';
import { Bell } from 'lucide-react';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const containerRef = useRef(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  const loadNotifications = useCallback(async () => {
    try {
      const res = await apiFetch('/notifications');
      if (res.success) {
        setItems(res.notifications || []);
        setUnreadCount(res.unreadCount || 0);
      }
    } catch {
      // Non-critical — bell simply shows empty state
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    // Periodic refresh — polling keeps this dependency-free and works across roles
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  // Close the dropdown on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const markAllRead = async () => {
    try {
      await apiFetch('/notifications/read-all', { method: 'PUT' });
      loadNotifications();
    } catch {
      // ignore
    }
  };

  const handleOpenComplaint = async (notification) => {
    setOpen(false);
    if (!notification.referenceId) return;

    // Route to the correct portal based on the signed-in role
    const base = user && user.role === 'student' ? '/student/complaints' : '/admin/complaints';
    navigate(`${base}/${notification.referenceId}`);
  };

  return (
    <div className="notif-bell" ref={containerRef}>
      <button
        className="notif-trigger"
        onClick={() => setOpen(o => !o)}
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={open}
        title="Notifications"
      >
        <Bell size={16} aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="notif-count" aria-hidden="true">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notif-dropdown" role="dialog" aria-label="Notifications panel">
          <div className="notif-dropdown-header">
            <strong>Notifications</strong>
            {unreadCount > 0 && (
              <button className="notif-mark-read" onClick={markAllRead}>Mark all read</button>
            )}
          </div>
          <div className="notif-list">
            {items.length === 0 ? (
              <p className="notif-empty">No notifications yet.</p>
            ) : (
              items.slice(0, 8).map(n => (
                <button
                  key={n.id}
                  className={`notif-item ${n.isRead ? '' : 'notif-item-unread'}`}
                  onClick={() => handleOpenComplaint(n)}
                >
                  <span className="notif-title">{n.title}</span>
                  <span className="notif-message">{n.message}</span>
                  <span className="notif-date">{formatDate(n.createdAt)}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
