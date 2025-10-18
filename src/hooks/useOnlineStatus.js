import { useEffect, useRef } from 'react';
import { userStatusAPI } from '../rest-api/services/messages';
import userStatusWebSocketService from '../rest-api/services/userStatusWebSocket';

export const useOnlineStatus = () => {
  const isOnlineRef = useRef(false);
  const userIdRef = useRef(null);

  // Get user ID from session storage
  const getUserId = () => {
    try {
      const currentUser = sessionStorage.getItem('currentUser');
      if (currentUser) {
        const userData = JSON.parse(currentUser);
        return userData.id;
      }
    } catch (error) {
      console.error('Error getting user ID:', error);
    }
    return null;
  };

  // Update online status
  const updateOnlineStatus = async (isOnline) => {
    const userId = getUserId();
    if (!userId) return;

    try {
      await userStatusAPI.updateStatus(userId, isOnline);
      isOnlineRef.current = isOnline;
      console.log(`User ${userId} status updated to: ${isOnline ? 'online' : 'offline'}`);
    } catch (error) {
      console.error('Failed to update online status:', error);
    }
  };

  // Set user online
  const setOnline = () => {
    const userId = getUserId();
    if (userId && !isOnlineRef.current) {
      userIdRef.current = userId;
      updateOnlineStatus(true);
    }
  };

  // Set user offline
  const setOffline = () => {
    if (userIdRef.current && isOnlineRef.current) {
      updateOnlineStatus(false);
    }
  };

  useEffect(() => {
    // Set online when hook mounts (user enters dashboard)
    setOnline();
    
    // Connect to user status WebSocket
    userStatusWebSocketService.connect().then(() => {
      console.log('User status WebSocket connected');
    }).catch(error => {
      console.error('Failed to connect to user status WebSocket:', error);
    });

    // Handle page visibility change
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setOffline();
      } else {
        setOnline();
      }
    };

    // Handle before unload (user closes tab/browser)
    const handleBeforeUnload = () => {
      if (isOnlineRef.current) {
        // Use sendBeacon for reliable delivery during page unload
        const userId = userIdRef.current;
        if (userId) {
          navigator.sendBeacon(`/users/${userId}/status/false`);
        }
      }
    };

    // Handle page unload
    const handleUnload = () => {
      setOffline();
    };

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('unload', handleUnload);

    // Cleanup function
    return () => {
      // Set offline when component unmounts
      setOffline();
      
      // Disconnect from user status WebSocket
      userStatusWebSocketService.disconnect();
      
      // Remove event listeners
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('unload', handleUnload);
    };
  }, []);

  return {
    setOnline,
    setOffline,
    updateOnlineStatus
  };
};