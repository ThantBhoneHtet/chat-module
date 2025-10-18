import { useState, useEffect } from 'react';
import { messagesAPI, websocketAPI } from '../../rest-api/services/messages';

export const useUnreadMessageCount = (currentUserId) => {
  const [unreadCounts, setUnreadCounts] = useState({});
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);

  useEffect(() => {
    if (!currentUserId) return;

    const unsubscribeFunctions = [];

    const fetchAndSetupRealtime = async () => {
      try {
        const chats = await messagesAPI.getConversations(currentUserId);
        const newUnreadCounts = {};
        
        // Initialize unread counts
        chats.forEach(chat => {
          newUnreadCounts[chat.chatId] = chat.unreadCounts[currentUserId] || 0;
        });
        
        setUnreadCounts(newUnreadCounts);
        
        // Calculate total
        const total = Object.values(newUnreadCounts).reduce((sum, count) => sum + count, 0);
        setTotalUnreadCount(total);

        // Set up real-time subscriptions for all chats
        for (const chat of chats) {
          try {
            const unsubscribe = await websocketAPI.subscribeToChat(chat.chatId, (payload) => {
              if (payload.type === 'MESSAGE_DELETED') {
                // Decrement unread count if deleted message was from another user and was unread
                if (payload.deletedMessage.senderId !== currentUserId) {
                  setUnreadCounts(prev => {
                    const newCounts = {
                      ...prev,
                      [chat.chatId]: Math.max(0, (prev[chat.chatId] || 0) - 1)
                    };
                    setTotalUnreadCount(Object.values(newCounts).reduce((sum, count) => sum + count, 0));
                    return newCounts;
                  });
                }
              } else if (payload.type !== 'MESSAGE_EDITED') {
                // Increment unread count for new messages from other users
                if (payload.senderId !== currentUserId) {
                  setUnreadCounts(prev => {
                    const newCounts = {
                      ...prev,
                      [chat.chatId]: (prev[chat.chatId] || 0) + 1
                    };
                    setTotalUnreadCount(Object.values(newCounts).reduce((sum, count) => sum + count, 0));
                    return newCounts;
                  });
                }
              }
            });
            
            if (unsubscribe) {
              unsubscribeFunctions.push(unsubscribe);
            }
          } catch (error) {
            console.error('Failed to subscribe to chat:', chat.chatId, error);
          }
        }
      } catch (error) {
        console.error('Error fetching chats and setting up real-time updates:', error);
      }
    };

    fetchAndSetupRealtime();

    return () => {
      unsubscribeFunctions.forEach(unsubscribe => {
        try {
          unsubscribe();
        } catch (error) {
          console.error('Error unsubscribing:', error);
        }
      });
    };
  }, [currentUserId]);

  return { totalUnreadCount, hasUnread: totalUnreadCount > 0 };
};