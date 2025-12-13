import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Image, Send, Paperclip, MoreVertical, Pencil, UserPlus, Users, Bookmark } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent } from './ui/card';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { messagesAPI, websocketAPI, chatAPI } from '../../rest-api/services/messages';
import { MessageDisplay } from './MessageDisplay';
import { MessageInput } from './MessageInput';
import { usersAPI } from '../../rest-api/services/users';
import webSocketService from '../../rest-api/services/websocket';
import userStatusWebSocketService from '../../rest-api/services/userStatusWebSocket';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import avatarPlaceholder from "../../assets/avatar.jpg";
import HamburgerMenu from './HamburgerMenu';
import AddContactModal from './AddContactModal';
import CreateGroupModal from './CreateGroupModal';
import ChatEditModal from './ChatEditModal';
import { toast } from 'sonner';

const Messages = ({ trackUserStatus = true, selectedChatFromExternal = null }) => {
  // const navigate = useNavigate();
  
  if(trackUserStatus) {
    // Initialize online status tracking
    useOnlineStatus();
  }

  const [selectedContact, setSelectedContact] = useState();
  const [selectedChat, setSelectedChat] = useState(null); // selected chat
  const [editingMessage, setEditingMessage] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);

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
  const [savedMessageIds, setSavedMessageIds] = useState([]); // Track saved message IDs for current user

  // Modal states
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isChatEditOpen, setIsChatEditOpen] = useState(false);

  // Global chat list subscription for updating latest messages
  useEffect(() => {
    const globalUnsubscribeFunctions = [];
    
    const fetchChats = async () => {
      setIsLoading(true);
      try {
        // Fetch saved message IDs for current user
        const savedMsgIds = await usersAPI.getSavedMessages(currentUser.userId);
        setSavedMessageIds(savedMsgIds || []);

        const chats = await messagesAPI.getConversations(currentUser.userId);
        const newMessages = {};
        const newUnreadCounts = {};
        
        // Enhance chats with participant names for direct messages
        const enhancedChats = await Promise.all(
          chats.map(async chat => {
            newMessages[chat.chatId] = {
              content: chat.lastMessage,
              time: formatTimestamp(chat.lastMessageTime),
            };
            
            newUnreadCounts[chat.chatId] = chat.unreadCounts[currentUser.userId] || 0;

            if (chat.type === 'DIRECT') {
              const otherUserId = chat.participants.find(id => id !== currentUser.userId);
              if (otherUserId) {
                try {
                  const user = await usersAPI.getProfile(otherUserId);
                  
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
                if (payload.deletedMessage.senderId !== currentUser.userId) {
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
                if (payload.senderId !== currentUser.userId && 
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
    
    if (currentUser?.userId) { 
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
  }, [currentUser?.userId]);

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

  // Reset states when selecting a new chat
  useEffect(() => {
    if (selectedChat) {
      setUnreadCounts(prev => ({
        ...prev,
        [selectedChat.chatId]: 0
      }));
      // Clear edit/reply state when changing chats
      setEditingMessage(null);
      setReplyingTo(null);
    }
  }, [selectedChat?.chatId]);

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
  //     const otherUserIds = chat.participants?.filter(userId => userId !== currentUser.userId) || [];
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
      return [chat.otherParticipant?.firstName, chat.otherParticipant?.lastName]
        .filter(Boolean)
        .join(' ') || '';
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
    setReplyingTo(null); // Clear reply when editing
  }

  const handleCancelEdit = () => {
    setEditingMessage(null);
  }

  const handleReplyMessage = (message) => {
    setReplyingTo(message);
    setEditingMessage(null); // Clear edit when replying
  }

  const handleCancelReply = () => {
    setReplyingTo(null);
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

  // Handle opening saved messages
  const handleOpenSavedMessages = async () => {
    // Refresh saved message IDs
    const savedMsgIds = await usersAPI.getSavedMessages(currentUser.userId);
    setSavedMessageIds(savedMsgIds || []);
    
    // Create a virtual "Saved Messages" chat
    const savedMessagesChat = {
      chatId: 'saved-messages',
      type: 'SAVED',
      groupName: 'Saved Messages',
      participants: [currentUser.userId],
      isSavedMessagesChat: true
    };
    
    setSelectedChat(savedMessagesChat);
    setSelectedContact(-2); // Special index for saved messages
  };

  // Handle user selection from AddContactModal
  const handleSelectUser = useCallback(async (selection) => {
    if (selection.type === 'existing') {
      // Find existing chat and select it
      const existingChat = chats.find(chat => chat.chatId === selection.chatId);
      if (existingChat) {
        setSelectedChat(existingChat);
        const chatIndex = chats.findIndex(chat => chat.chatId === selection.chatId);
        setSelectedContact(chatIndex);
      } else {
        // Fetch the chat if not in list
        try {
          const chatData = await chatAPI.getChatById(selection.chatId);
          const enhancedChat = {
            ...chatData,
            otherParticipant: {
              id: selection.user.userId,
              firstName: selection.user.firstName,
              lastName: selection.user.lastName,
              avatarUrl: selection.user.avatarUrl,
              isOnline: selection.user.isOnline
            }
          };
          setChats(prev => [enhancedChat, ...prev]);
          setSelectedChat(enhancedChat);
          setSelectedContact(0);
        } catch (error) {
          console.error('Error fetching chat:', error);
        }
      }
    } else {
      // New temporary chat
      setSelectedChat(selection.tempChat);
      setSelectedContact(-1); // Not in the list yet
    }
  }, [chats]);

  // Handle first message sent in temporary chat - creates real chat
  const handleFirstMessageSent = useCallback(async (tempChatId, realChat) => {
    // Replace temporary chat with real chat in state
    setChats(prev => {
      const filteredChats = prev.filter(c => c.chatId !== tempChatId);
      return [realChat, ...filteredChats];
    });
    setSelectedChat(realChat);
    setSelectedContact(0);
    
    // Initialize latest message for the new chat
    setLatestMessages(prev => ({
      ...prev,
      [realChat.chatId]: {
        content: realChat.lastMessage || '',
        time: formatTimestamp(realChat.lastMessageTime)
      }
    }));
  }, []);

  // Handle chat updated (participants changed)
  const handleChatUpdated = useCallback((updatedChat) => {
    setChats(prev => prev.map(c => 
      c.chatId === updatedChat.chatId ? { ...c, ...updatedChat } : c
    ));
    setSelectedChat(prev => prev?.chatId === updatedChat.chatId ? { ...prev, ...updatedChat } : prev);
  }, []);

  // Handle leaving a chat
  const handleLeaveChat = useCallback((chatId) => {
    setChats(prev => prev.filter(c => c.chatId !== chatId));
    setSelectedChat(null);
    setSelectedContact(undefined);
  }, []);

  // Handle navigating to a chat from ChatEditModal (when clicking on a member)
  const handleNavigateToChat = useCallback((chatId, tempChat = null) => {
    if (chatId) {
      // Navigate to existing chat
      const existingChat = chats.find(c => c.chatId === chatId);
      if (existingChat) {
        setSelectedChat(existingChat);
        const chatIndex = chats.findIndex(c => c.chatId === chatId);
        setSelectedContact(chatIndex);
      }
    } else if (tempChat) {
      // Create temporary chat for new conversation
      setChats(prev => [tempChat, ...prev]);
      setSelectedChat(tempChat);
      setSelectedContact(0);
    }
  }, [chats]);

  return (
    <div className="h-screen flex bg-card rounded-lg shadow-sm border">
      {/* Contacts List */}
      <div className="w-80 h-full border-r bg-muted/30">
        <div className="p-4 h-[15%] border-b bg-card"> 
          <div className="flex items-center gap-2">
            <HamburgerMenu 
              currentUser={currentUser} 
              onOpenSavedMessages={handleOpenSavedMessages}
            />
            
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search conversations..." className="pl-10" />
            </div>
            
            {/* New Chat Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 hover:bg-primary/90 rounded-lg bg-primary"
                  title="New Chat"
                >
                  <Pencil className="h-5 w-5 text-primary-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-popover z-50">
                <DropdownMenuItem 
                  onClick={() => setIsAddContactOpen(true)}
                  className="cursor-pointer"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  New Contact
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setIsCreateGroupOpen(true)}
                  className="cursor-pointer"
                >
                  <Users className="h-4 w-4 mr-2" />
                  New Group
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        
        {/* Add Contact Modal */}
        <AddContactModal
          open={isAddContactOpen}
          onOpenChange={setIsAddContactOpen}
          currentUser={currentUser}
          onSelectUser={handleSelectUser}
          existingChats={chats}
        />
        
        {/* Create Group Modal */}
        <CreateGroupModal
          open={isCreateGroupOpen}
          onOpenChange={setIsCreateGroupOpen}
          currentUser={currentUser}
          existingChats={chats}
          onGroupCreated={(newGroup) => {
            // Add new group to chats list and select it
            setChats(prev => [newGroup, ...prev]);
            setSelectedChat(newGroup);
            setSelectedContact(0);
          }}
        />
        
        <div className="h-[85%] overflow-y-scroll">
          {/* Saved Messages - Always at top */}
          {!isLoading && (
            <div
              onClick={handleOpenSavedMessages}
              className={`p-4 border-b cursor-pointer hover:bg-card transition-colors ${
                selectedContact === -2 ? 'bg-card border-l-4 border-l-primary' : ''
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
                    <Bookmark className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-foreground truncate">Saved Messages</h3>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      {savedMessageIds.length}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {savedMessageIds.length > 0 ? 'Tap to view saved messages' : 'No saved messages yet'}
                  </p>
                </div>
              </div>
            </div>
          )}

          { isLoading && (
            <div className="flex items-center justify-center h-full">              
              <p>Loading your chats...</p>
            </div>
          )
          }
          {
            !isLoading && chats.length === 0 && (
              <div className="flex items-center justify-center h-full pt-8">
                <p>No chats found.</p>
              </div>
            )
          }
          { !isLoading && chats.map((chat, index) => (
            <div
              key={chat.chatId}
              onClick={async () => {
                setSelectedChat(chat);
                setSelectedContact(index);
              }}
              className={`p-4 border-b cursor-pointer hover:bg-card transition-colors ${
                selectedContact === index ? 'bg-card border-l-4 border-l-primary' : ''
              }`}
            >
              <div className="flex items-center space-x-3">
                 <div className="relative">
                   <Avatar className="h-12 w-12 cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all">
                     <AvatarImage src={chat.type === 'DIRECT' ? chat.otherParticipant?.avatarUrl || chat.otherParticipant?.logoUrl || avatarPlaceholder : chat.gpImageUrl} />
                     <AvatarFallback className='bg-primary/20 text-primary'>{chat.name?.split(' ').map(n => n[0]).join('') || chat.groupName?.split(' ').slice(0, 2).map(n => n[0]).join('')}</AvatarFallback>
                   </Avatar>
                  {(chat.type === 'DIRECT' && userStatuses[chat.otherParticipant?.id]) && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-card"></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-foreground truncate">{getChatName(chat) || 'User'}</h3>
                    <span className="text-xs text-muted-foreground">{latestMessages[chat.chatId]?.time || ''}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground truncate">{latestMessages[chat.chatId]?.content || latestMessages[chat.chatId]?.attachmentName || 'Say hi to start conversation!'}</p>
                    {unreadCounts[chat.chatId] > 0 && (
                      <span className="bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
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
              <h2 className="text-xl text-center font-bold text-foreground mb-3">Select a chat to start a conversation</h2>
            </div>
          </div>
        )}

        {
        selectedChat && (
          <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div 
          className="p-4 border-b bg-card flex items-center justify-between cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => !selectedChat.isTemporary && !selectedChat.isSavedMessagesChat && setIsChatEditOpen(true)}
        >
          <div className="flex items-center space-x-3">
            {selectedChat.isSavedMessagesChat ? (
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Bookmark className="h-5 w-5 text-primary fill-primary" />
              </div>
            ) : (
              <Avatar className="h-10 w-10">
                <AvatarImage src={selectedChat.otherParticipant?.avatarUrl || selectedChat.gpImageUrl} />
                <AvatarFallback className="bg-primary/20 text-primary">
                  { selectedChat.groupName?.charAt(0) }
                </AvatarFallback>
              </Avatar>
            )}
            <div>
              <h3 className="font-medium text-foreground">{selectedChat.groupName || getChatName(selectedChat) || 'Chat'}</h3>
              <p className="text-sm text-muted-foreground">
                {selectedChat.isSavedMessagesChat ? (
                  `${savedMessageIds.length} saved messages`
                ) : selectedChat.type === 'GROUP' || selectedChat.type === 'GLOBAL' ? (
                  `${onlineCount ?? 'Loading...'} online`
                ) : (
                  userStatuses[selectedChat.otherParticipant?.id] ? 'Online' : selectedChat.otherParticipant?.lastActive || 'Offline'
                )}
              </p>
            </div>
          </div>
          {!selectedChat.isSavedMessagesChat && (
            <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
              <MoreVertical className="h-5 w-5" />
            </Button>
          )}
        </div>

        {/* Chat Edit Modal */}
        <ChatEditModal
          open={isChatEditOpen}
          onOpenChange={setIsChatEditOpen}
          chat={selectedChat}
          currentUser={currentUser}
          existingChats={chats}
          onChatUpdated={handleChatUpdated}
          onLeaveChat={handleLeaveChat}
          onNavigateToChat={handleNavigateToChat}
        />

        {/* Messages */}
       
        <MessageDisplay 
          chatId={selectedChat.chatId} 
          onMessageReceived={updateLatestMessage} 
          onEditMessage={handleEditMessage}
          onReplyMessage={handleReplyMessage}
          isGloballySubscribed={!selectedChat.isTemporary && !selectedChat.isSavedMessagesChat}
          incomingMessage={incomingMessageForDisplay}
          onBottomStateChange={handleBottomStateChange}
          isTemporaryChat={selectedChat.isTemporary}
          otherUserName={getChatName(selectedChat)}
          isSavedMessagesChat={selectedChat.isSavedMessagesChat}
          savedMessageIds={savedMessageIds}
        />

        {/* Message Input - hide for Saved Messages chat */}
        {!selectedChat.isSavedMessagesChat && (
          <MessageInput 
            chatId={selectedChat.chatId} 
            editingMessage={editingMessage}
            onCancelEdit={handleCancelEdit}
            replyingTo={replyingTo}
            onCancelReply={handleCancelReply}
            isTemporaryChat={selectedChat.isTemporary}
            tempChatData={selectedChat.isTemporary ? selectedChat : null}
            onFirstMessageSent={handleFirstMessageSent}
            currentUserId={currentUser.userId}
          />
        )}
      </div>
      )
      }
    </div>
  );
};

export default Messages;
