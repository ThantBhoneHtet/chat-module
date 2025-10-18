import { useState, useEffect, useCallback } from 'react';
import { notificationAPI } from '../../rest-api/services/notification-api';

export const useNotifications = (recipientId) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load notifications
  const loadNotifications = useCallback(async () => {
    if (!recipientId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await notificationAPI.getNotificationsByRecipient(recipientId);
      setNotifications(Array.isArray(data) ? data : []);
      
      // Calculate unread count from the main list
      const unread = data.filter(notification => !notification.read).length;
      setUnreadCount(unread);
    } catch (err) {
      setError(err.message);
      console.error('Error loading notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [recipientId]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId) => {
    try {
      await notificationAPI.markNotificationAsRead(notificationId);
      
      // Update local state
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === notificationId 
            ? { ...notif, read: true }
            : notif
        )
      );
      
      // Update unread count
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!recipientId) return;
    
    try {
      await notificationAPI.markAllAsRead(recipientId);
      
      // Update local state
      setNotifications(prev => 
        prev.map(notif => ({ ...notif, read: true }))
      );
      
      // Update unread count
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  }, [recipientId]);

  // Delete notification (soft delete)
  const deleteNotification = useCallback(async (notificationId) => {
    try {
      // Soft delete - remove from local state
      setNotifications(prev => 
        prev.filter(notif => notif.id !== notificationId)
      );
      
      // Update unread count if notification was unread
      const deletedNotification = notifications.find(notif => notif.id === notificationId);
      if (deletedNotification && !deletedNotification.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  }, [notifications]);

  // Initialize
  useEffect(() => {
    if (recipientId) {
      loadNotifications();
    }
  }, [recipientId, loadNotifications]);

  // Refresh notifications
  const refresh = useCallback(() => {
    loadNotifications();
  }, [loadNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh
  };
};