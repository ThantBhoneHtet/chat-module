
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Image, Send, Paperclip, MoreVertical } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent } from './ui/card';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { messagesAPI, websocketAPI } from '../../rest-api/services/messages';
// removed unused import 'use' from react
import { MessageDisplay } from './MessageDisplay';
import { MessageInput } from './MessageInput';
import { volunteersAPI } from '../../rest-api/services/volunteers';
import { set } from 'date-fns';
import webSocketService from '../../rest-api/services/websocket';
import userStatusWebSocketService from '../../rest-api/services/userStatusWebSocket';
// import { organizationsAPI } from '../../rest-api';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import avatarPlaceholder from "../../assets/avatar.jpg";

const Messages = ({ trackUserStatus = false, selectedChatFromExternal = null }) => {
  // const navigate = useNavigate();
  
  if(trackUserStatus) {
    // Initialize online status tracking
    useOnlineStatus();
  }

  const [selectedContact, setSelectedContact] = useState();
  const [selectedChat, setSelectedChat] = useState(null); // selected chat
  const [editingMessage, setEditingMessage] = useState(null);

  const [isLoading, setIsLoading] = useState(false);

  const currentUserRaw = sessionStorage.getItem('currentUser');
  const currentUser = currentUserRaw ? JSON.parse(currentUserRaw) : null;
  const [otherParticipants, setOtherParticipants] = useState([]);

  const [chats, setChats] = useState([]); // List of chats for a current user
  const [latestMessages, setLatestMessages] = useState({});
  const [unreadCounts, setUnreadCounts] = useState({});
  const [onlineCount, setOnlineCount] = useState(null);
  const [currentChatMessages, setCurrentChatMessages] = useState({});
  const [incomingMessageForDisplay, setIncomingMessageForDisplay] = useState(null);
  const [userStatuses, setUserStatuses] = useState({}); // Track online status of users
  const [isAtBottom, setIsAtBottom] = useState(true); // Track if user is at bottom of current chat


  // Global chat list subscription for updating latest messages
  useEffect(() => {
    const globalUnsubscribeFunctions = [];
    
    const fetchChats = async () => {
      setIsLoading(true);
      try {
        const chats = await messagesAPI.getConversations(currentUser.id);
        const newMessages = {};
        const newUnreadCounts = {};
        
        // Enhance chats with participant names for direct messages
        const enhancedChats = await Promise.all(
          chats.map(async chat => {
            newMessages[chat.chatId] = {
              content: chat.lastMessage,
              time: formatTimestamp(chat.lastMessageTime),
            };
            
            newUnreadCounts[chat.chatId] = chat.unreadCounts[currentUser.id] || 0;

            if (chat.type === 'DIRECT') {
              const otherUserId = chat.participants.find(id => id !== currentUser.id);
              if (otherUserId) {
                try {
                  const userVol = await volunteersAPI.getProfile(otherUserId);
                  // const userOrg = await organizationsAPI.getProfile(otherUserId);
                  const user = userVol;
                  return {
                    ...chat,
                    otherParticipant: {
                      'firstName' : user.firstName || user.organizationName,
                      'lastName' : user.lastName || '',
                      'avatarUrl' : user.avatarUrl,
                      'logoUrl' : user.logoUrl,
                      'isOnline' : user.isOnline,
                      'lastActive' : user.lastActive,
                      'id': otherUserId
                    }
                  };
                } catch (error) {
                  console.error("Failed to fetch user profile:", error);
                  return chat;
                }
              }
            }
            return chat;
          })
        );
        
        setLatestMessages(newMessages);
        setUnreadCounts(newUnreadCounts);
        setChats(enhancedChats);

        // Initialize user statuses
        const initialStatuses = {};
        enhancedChats.forEach(chat => {
          if (chat.type === 'DIRECT' && chat.otherParticipant) {
            initialStatuses[chat.otherParticipant.id] = chat.otherParticipant.isOnline;
          }
        });
        setUserStatuses(initialStatuses);

        // Handle external chat selection
        if (selectedChatFromExternal) {
          const externalChat = enhancedChats.find(chat => chat.chatId === selectedChatFromExternal.chatId);
          if (externalChat) {
            setSelectedChat(externalChat);
            const chatIndex = enhancedChats.findIndex(chat => chat.chatId === selectedChatFromExternal.chatId);
            setSelectedContact(chatIndex);
          }
        }
        
        // Global subscription for all chats to update latest messages and unread counts
        for (const chat of enhancedChats) {
          try {
            const unsubscribe = await websocketAPI.subscribeToChat(chat.chatId, (payload) => {
              if (payload.type === 'MESSAGE_DELETED') {
                // Always update latest message for this chat
                if (payload.latestMessage) {
                  setLatestMessages(prev => ({
                    ...prev,
                    [chat.chatId]: {
                      content: payload.latestMessage.content,
                      time: formatTimestamp(payload.latestMessage.sentAt),
                    }
                  }));
                }
                
                // Decrement unread count if deleted message was from another user and was unread
                if (payload.deletedMessage.senderId !== currentUser.id) {
                  setUnreadCounts(prev => ({
                    ...prev,
                    [chat.chatId]: Math.max(0, (prev[chat.chatId] || 0) - 1)
                  }));
                }
                
                // Forward to MessageDisplay if this is the selected chat
                if (selectedChat && payload.deletedMessage.chatId === selectedChat.chatId) {
                  const newPayload = {
                    ...payload.deletedMessage, 
                    type: 'MESSAGE_DELETED', 
                    latestMessage: payload.latestMessage
                  };
                  setIncomingMessageForDisplay(newPayload);
                }
                console.log('Message deleted in chat:', chat.chatId);
              } else if (payload.type === 'MESSAGE_EDITED') {
                // Update current chat messages if this is the selected chat
                if (selectedChat && payload.editedMessage.chatId === selectedChat.chatId) {
                  const newPayload = {
                    ...payload.editedMessage, 
                    type: 'MESSAGE_EDITED',
                    latestMessage: payload.latestMessage
                  };
                  setIncomingMessageForDisplay(newPayload);
                }
                console.log("Message edited in chat");
                
                // Always update latest message for this chat if the edited message was the latest
                setLatestMessages(prev => {
                  const current = prev[chat.chatId];
                  if (current && payload.editedMessage.messageId === current.messageId) {
                    return {
                      ...prev,
                      [chat.chatId]: {
                        ...current,
                        content: payload.editedMessage.content,
                      }
                    };
                  }
                  return prev;
                });
                
                // Update latest message if provided
                if (payload.latestMessage) {
                  setLatestMessages(prev => ({
                    ...prev,
                    [chat.chatId]: {
                      content: payload.latestMessage.content,
                      time: formatTimestamp(payload.latestMessage.sentAt),
                    }
                  }));
                }
              } else {
                // Update latest message for this chat
                setLatestMessages(prev => ({
                  ...prev,
                  [chat.chatId]: {
                    content: payload.attachmentName || payload.content,
                    time: formatTimestamp(payload.sentAt),
                  }
                }));
                
                // Update current chat messages if this is the selected chat
                if (selectedChat && payload.chatId) {
                  setIncomingMessageForDisplay(payload);
                }
                
                // Update unread count if message is not from current user and either:
                // 1. Not in the selected chat, OR
                // 2. In the selected chat but not at bottom (not actively reading)
                if (payload.senderId !== currentUser.id && 
                    (!selectedChat || payload.chatId !== selectedChat.chatId || 
                     (payload.chatId === selectedChat.chatId && !isAtBottom))) {
                  setUnreadCounts(prev => ({
                    ...prev,
                    [chat.chatId]: (prev[chat.chatId] || 0) + 1
                  }));
                }
              
              }
            });
            
            if (unsubscribe) {
              globalUnsubscribeFunctions.push(unsubscribe);
            }
          } catch (error) {
            console.error('Failed to subscribe to chat:', chat.chatId, error);
          }
        }
        
      } catch (error) {
        console.error("Failed to fetch chats:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (currentUser?.id) { 
      fetchChats();
    }
    
    // Subscribe to user status updates
    const handleUserStatusUpdate = (statusUpdate) => {
      const { userId, isOnline } = statusUpdate;
      setUserStatuses(prev => ({
        ...prev,
        [userId]: isOnline
      }));
      
      // Update chat list with new status
      setChats(prev => prev.map(chat => {
        if (chat.type === 'DIRECT' && chat.otherParticipant?.id === userId) {
          return {
            ...chat,
            otherParticipant: {
              ...chat.otherParticipant,
              isOnline
            }
          };
        }
        return chat;
      }));
    };

    // Connect to user status WebSocket and subscribe
    userStatusWebSocketService.connect()
      .then(() => {
        const statusUnsubscribe = userStatusWebSocketService.addStatusUpdateCallback(handleUserStatusUpdate);
        if (statusUnsubscribe) {
          globalUnsubscribeFunctions.push(statusUnsubscribe);
        }
      })
      .catch(error => {
        console.warn('Failed to connect to user status WebSocket:', error);
      });

    // Cleanup function
    return () => {
      globalUnsubscribeFunctions.forEach(unsubscribe => {
        try {
          unsubscribe();
        } catch (error) {
          console.error('Error unsubscribing:', error);
        }
      });
    };
  }, [currentUser?.id]);

  // Handle external chat selection
  useEffect(() => {
    if (selectedChatFromExternal && chats.length > 0) {
      const externalChat = chats.find(chat => chat.chatId === selectedChatFromExternal.chatId);
      if (externalChat) {
        setSelectedChat(externalChat);
        const chatIndex = chats.findIndex(chat => chat.chatId === selectedChatFromExternal.chatId);
        setSelectedContact(chatIndex);
      }
    }
  }, [selectedChatFromExternal, chats]);

  // Reset unread count when selecting a chat
  useEffect(() => {
    if (selectedChat) {
      setUnreadCounts(prev => ({
        ...prev,
        [selectedChat.chatId]: 0
      }));
    }
  }, [selectedChat]);

  // Callback to receive isAtBottom state from MessageDisplay
  const handleBottomStateChange = (atBottom) => {
    setIsAtBottom(atBottom);
  };

  useEffect(() => {
    const fetchOnlineCount = async () => {
      if (!selectedChat) return;
      // console.log(selectedChat.participants);
      let count;
      if (selectedChat.type === 'GROUP') {
        count = await messagesAPI.getOnlineUsersCount(selectedChat.participants);
      } else if (selectedChat.type === 'GLOBAL') {
        count = await messagesAPI.getOnlineUsersCount(null , true); // Assuming `true` fetches global count
      }
      setOnlineCount(count);
    };

    fetchOnlineCount();
  }, [selectedChat, userStatuses]);

  // const getChatUserStatus = async(chat) => {
  //   if (!chat || !currentUser) return;
    
  //   try {
  //     const otherUserIds = chat.participants?.filter(userId => userId !== currentUser.id) || [];
  //     if (otherUserIds.length > 0) {
  //       const otherUserStatus = await messagesAPI.getUserStatus(otherUserIds[0]);
  //       setOtherParticipants([otherUserStatus]);
  //     }
  //   } catch (error) {
  //     console.error("Failed to fetch user status:", error);
  //   }
  // }

  // const handleChatRoom = async (chatId) => {
  //   // websocketAPI.connect(chatId);
  //   const participants = await messagesAPI.getChatParticpants(chatId);
  //   setParticipants(participants);
  // }

  function formatTimestamp(timestamp) {
    if (!timestamp || typeof timestamp.seconds !== 'number') return '';
    const date = new Date(timestamp.seconds * 1000);
    const now = new Date();

    // Helper for midnight resets
    const isSameDay = date.toDateString() === now.toDateString();

    // Today → hh:mm AM/PM
    if (isSameDay) {
      return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    }

    // Start of current week (Sunday by default, adjust if needed)
    const startOfWeek = new Date(now);
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(now.getDate() - now.getDay()); 

    if (date >= startOfWeek) {
      // Within this week → weekday name
      return date.toLocaleDateString([], { weekday: 'short' }); // "Mon", "Tue"
    }

    // Same year but older than a week
    if (date.getFullYear() === now.getFullYear()) {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' }); // "May 4"
    }

    // Different year → dd.MM.yy
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${day}.${month}.${year}`; // "30.08.24"
  }


  function getChatName(chat) {
    if (chat.type === 'GROUP') {
      return chat.groupName;
    } else if (chat.type === 'GLOBAL') {
      return 'Global Chat';
    } else {
      return chat.otherParticipant?.firstName + ' ' + chat.otherParticipant?.lastName;
    }
  }

  const updateLatestMessage = (chatId, message) => {
    setLatestMessages(prev => ({
      ...prev,
      [chatId]: {
        content: message.attachmentName !== null ? message.attachmentName : message.content,
        time: formatTimestamp(message.sentAt),
      }
    }));
  }

  const handleEditMessage = (message) => {
    setEditingMessage(message);
  }

  const handleCancelEdit = () => {
    setEditingMessage(null);
  }

  // Show error if no current user
  if (!currentUser) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Card className="w-96">
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-semibold mb-2">No User Found</h2>
            <p className="text-muted-foreground">Please log in to view messages.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex bg-white rounded-lg shadow-sm border">
      {/* Contacts List */}
      <div className="w-80 border-r bg-gray-50">
        <div className="p-4 border-b bg-white"> 
          <h2 className="text-xl font-bold text-gray-900 mb-3">Messages</h2>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input placeholder="Search conversations..." className="pl-10" />
          </div>
        </div>
        
        <div className="h-3/4 overflow-y-scroll">
          { isLoading && (
            <div className="flex items-center justify-center h-full">              
              <p>Loading your chats...</p>
            </div>
          )
          }
          {
            !isLoading && chats.length === 0 && (
              <div className="flex items-center justify-center h-full">
                <p>No chats found.</p>
              </div>
            )
          }
          { !isLoading && chats.map((chat, index) => (
            <div
              key={chat.chatId}
              onClick={async () => {
                setSelectedChat(chat);
                // await handleChatRoom(chat.chatId);
                setSelectedContact(index);
                // await getChatUserStatus(chat);
              }}
              className={`p-4 border-b cursor-pointer hover:bg-white transition-colors ${
                selectedContact === index ? 'bg-white border-l-4 border-l-blue-600' : ''
              }`}
            >
              <div className="flex items-center space-x-3">
                 <div className="relative">
                   <Avatar 
                     className="h-12 w-12 cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all"
                     onClick={() => {
                      //  if (chat.type === 'DIRECT' && chat.otherParticipant?.userType === 'volunteer') {
                      //    navigate(`/volunteer/${chat.otherParticipant.id}`);
                      //  }
                     }}
                   >
                     <AvatarImage src={chat.type === 'DIRECT' ? chat.otherParticipant?.avatarUrl || chat.otherParticipant?.logoUrl || avatarPlaceholder : ''} />
                     <AvatarFallback className='bg-blue-200'>{chat.name?.split(' ').map(n => n[0]).join('') || chat.groupName?.split(' ').slice(0, 2).map(n => n[0]).join('')}</AvatarFallback>
                   </Avatar>
                  {(chat.type === 'DIRECT' && userStatuses[chat.otherParticipant?.id]) && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-gray-900 truncate">{getChatName(chat) || 'User'}</h3>
                    <span className="text-xs text-gray-500">{latestMessages[chat.chatId]?.time || ''}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600 truncate">{latestMessages[chat.chatId]?.content || latestMessages[chat.chatId]?.attachmentName || 'Say hi to start conversation!'}</p>
                    {unreadCounts[chat.chatId] > 0 && (
                      <span className="bg-blue-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                        {unreadCounts[chat.chatId]}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Area */}
        {
        selectedChat === null && (
          <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-center flex-1 overflow-y-auto p-4 space-y-4">
              <h2 className="text-xl text-center font-bold text-gray-900 mb-3">Select a chat to start a conversation</h2>
            </div>
          </div>
        )}

        {
        selectedChat && (
          <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="p-4 border-b bg-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={selectedChat.groupName?.charAt(0) /* contacts[selectedContact]?.avatar */} />
              <AvatarFallback>
                { selectedChat.groupName?.charAt(0) }
                {/* {contacts[selectedContact]?.name.split(' ').map(n => n[0]).join('')} */}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-medium text-gray-900">{selectedChat.groupName || 'Chat Name'}</h3>
              <p className="text-sm text-gray-500">
                {selectedChat.type === 'GROUP' || selectedChat.type === 'GLOBAL' ? (
                  `${onlineCount ?? 'Loading...'} online`
                ) : (
                  userStatuses[selectedChat.otherParticipant?.id] ? 'Online' : selectedChat.otherParticipant?.lastActive || 'Offline'
                )}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon">
            <MoreVertical className="h-5 w-5" />
          </Button>
        </div>

        {/* Messages */}
       
        <MessageDisplay 
          chatId={selectedChat.chatId} 
          onMessageReceived={updateLatestMessage} 
          onEditMessage={handleEditMessage}
          isGloballySubscribed={true}
          incomingMessage={incomingMessageForDisplay}
          onBottomStateChange={handleBottomStateChange}
        />

        {/* Message Input */}
        <MessageInput 
          chatId={selectedChat.chatId} 
          editingMessage={editingMessage}
          onCancelEdit={handleCancelEdit}
        />
      </div>
      )
      }
    </div>
  );
};

export default Messages;
