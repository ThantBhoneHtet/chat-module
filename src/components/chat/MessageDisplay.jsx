import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { messagesAPI, websocketAPI } from '../../rest-api/services/messages';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { Edit3, Trash2, Copy, ChevronDown, Check, CheckCheck } from 'lucide-react';
import { Button } from './ui/button';
// import { useToast } from '../../hooks/use-toast';
import webSocketService from '../../rest-api/services/websocket';
import userStatusWebSocketService from '../../rest-api/services/userStatusWebSocket';
import chatBackground from '../../assets/wallpaperflare.com_wallpaper.jpg';
import avatarPlaceholder from "../../assets/avatar.jpg";

export function MessageDisplay({ chatId, onMessageReceived, onEditMessage, isGloballySubscribed = false, incomingMessage = null, onBottomStateChange = null }) {
    // const navigate = useNavigate();
    const [messages, setMessages] = useState([]);
    const [participants, setParticipants] = useState({}); // participantsDto for the selected chat
    const [isLoading, setIsLoading] = useState(true);
    const [contextMenu, setContextMenu] = useState({ show: false, x: 0, y: 0, message: null });
    const [deleteDialog, setDeleteDialog] = useState({ show: false, messageId: null });
    const [isAtBottom, setIsAtBottom] = useState(true);
    const [showNewMessageIndicator, setShowNewMessageIndicator] = useState(false);
    const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
    const [userStatuses, setUserStatuses] = useState({}); // Track online status of users
    
    // Pagination state
  const [lastMsgId, setLastMsgId] = useState(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
    
    // const { toast } = useToast();
    
    const messagesContainerRef = useRef(null);
    const bottomElementRef = useRef(null);
    const topElementRef = useRef(null);
    const observerRef = useRef(null);
    const topObserverRef = useRef(null);
    
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    const currentUserId = currentUser.id || '';

    const loadMessages = async (lastMessageId = null, isLoadingOlder = false) => {
        try {
            const response = await messagesAPI.getMessages(chatId, lastMessageId, 20);
            
            // Handle array response (both dummy data and real API now return arrays)
            const newMessages = Array.isArray(response) ? response : [];
            const hasMore = newMessages.length === 20;
            
            if (isLoadingOlder) {
                if (newMessages.length > 0) {
                    const reversedMessages = [...newMessages].reverse(); // copy + reverse once

                    // Prepend reversed (oldest first)
                    setMessages(prev => [...reversedMessages, ...prev]);

                    // Oldest message is now first in reversedMessages
                    setLastMsgId(reversedMessages[0].messageId);
                }
            } else {
                // Initial load - reverse to show oldest first
                const reversedMessages = newMessages.reverse();
                setMessages(reversedMessages);
                // Set lastMsgId to the oldest message for pagination (first in reversed array)
                if (reversedMessages.length > 0) {
                    setLastMsgId(reversedMessages[0].messageId);
                }
            }
            
            setHasMoreMessages(hasMore);
            
            // Check if there are unread messages (only on initial load)
            if (!isLoadingOlder) {
                const unreadCount = newMessages.filter(msg => 
                    msg.senderId !== currentUserId && 
                    !msg.readBy?.includes(currentUserId)
                ).length;
                setHasUnreadMessages(unreadCount > 0);
            }
            
            return newMessages.length > 0;
        } catch (error) {
            console.error("Failed to load messages:", error);
            return false;
        }
    };

    const loadMoreMessages = useCallback(async () => {
    if (isLoadingMore || !hasMoreMessages) return;

    // console.log("Loading more messages...");
    setIsLoadingMore(true);

    const container = messagesContainerRef.current;
    if (!container) {
        setIsLoadingMore(false);
        return;
    }

    // Save current scroll position and height before loading
    const oldScrollHeight = container.scrollHeight;
    const oldScrollTop = container.scrollTop;

    // Disconnect observer to prevent multiple triggers
    if (topObserverRef.current) {
        topObserverRef.current.disconnect();
    }

    const success = await loadMessages(lastMsgId, true);

    if (success) {
        // Wait for DOM to update
        setTimeout(() => {
            const newScrollHeight = container.scrollHeight;
            const heightDifference = newScrollHeight - oldScrollHeight;
            
            // Maintain current position by adjusting scroll
            container.scrollTop = oldScrollTop + heightDifference;
            
            // Ensure we're not at the very top to prevent immediate re-trigger
            if (container.scrollTop < 100) {
                container.scrollTop = 100;
            }

            // Re-observe after a delay to prevent immediate re-trigger
            setTimeout(() => {
                if (topObserverRef.current && topElementRef.current && hasMoreMessages) {
                    topObserverRef.current.observe(topElementRef.current);
                }
            }, 300);
        }, 50);
    } else {
        // Re-observe even if failed
        setTimeout(() => {
            if (topObserverRef.current && topElementRef.current) {
                topObserverRef.current.observe(topElementRef.current);
            }
        }, 300);
    }

    setIsLoadingMore(false);
}, [lastMsgId, hasMoreMessages, isLoadingMore, loadMessages]);



    // Mark messages as read function with efficiency check
    const markMessagesAsRead = useCallback(async () => {
        if (!hasUnreadMessages || !isAtBottom) return;
        
        try {
            await messagesAPI.markAsRead(chatId, currentUserId);
            setHasUnreadMessages(false);
        } catch (error) {
            console.error("Failed to mark messages as read:", error);
        }
    }, [chatId, currentUserId, hasUnreadMessages, isAtBottom]);

    const fetchParticipants = async () => {
        const participantsList = await messagesAPI.getChatParticpants(chatId);
        const participantsData = {};
        await Promise.all(
            participantsList.map(async (participant) => {
                participantsData[participant.id] = {
                    firstName: participant.firstName,
                    lastName: participant.lastName,
                    avatarUrl: participant.avatarUrl,
                    isOnline: participant.isOnline,
                    lastActive: participant.lastActive,
                };
            })
        );

        setParticipants(participantsData);

        // Initialize user statuses from participants
        const initialStatuses = {};
        participantsList.forEach(participant => {
          initialStatuses[participant.id] = participant.isOnline;
        });
        setUserStatuses(initialStatuses);
    }
   
    useEffect(() => {
        const fetchMessages = async () => {
            setIsLoading(true);
            setLastMsgId(null);
            setHasMoreMessages(true);
            try {
                await loadMessages(null, false);
                await fetchParticipants();         
            } catch (error) {
                console.error("Failed to fetch messages:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchMessages();

        // Only subscribe to WebSocket if not globally subscribed by parent
        let unsubscribe = null;
        
        if (!isGloballySubscribed) {
            const handleIncomingMessage = (payload) => {
                // Only handle messages for the current chat
                // if (payload.chatId && payload.chatId !== chatId) {
                //     return;
                // }
                
                if (payload.type === 'MESSAGE_DELETED') {
                    console.log("msg deleted in Local");
                    setMessages(prev => prev.filter(
                        msg => msg.messageId !== payload.deletedMessage.messageId
                    ));
                    if (onMessageReceived) onMessageReceived(chatId, payload.latestMessage);
                } 
                else if (payload.type === 'MESSAGE_EDITED') {
                    console.log("msg edited in Local");
                    setMessages(prev => prev.map(msg => 
                        msg.messageId === payload.editedMessage.messageId ? payload.editedMessage : msg
                    ));
                    if (onMessageReceived) onMessageReceived(chatId, payload.latestMessage);
                }
            else {
                console.log("msg sent in Local");
                // Prevent duplicate messages by checking if message already exists
                setMessages(prev => {
                    const messageExists = prev.some(msg => msg.messageId === payload.messageId);
                    if (messageExists) {
                        return prev;
                    }
                    return [...prev, payload];
                });
                if (onMessageReceived) onMessageReceived(chatId, payload);
                
                // Mark as read if user is at bottom when new message arrives
                if (payload.senderId !== currentUserId) {
                    setHasUnreadMessages(true);
                }
            }
            };

            // Set up subscription
            const setupSubscription = async () => {
                try {
                    unsubscribe = await websocketAPI.subscribeToChat(chatId, handleIncomingMessage);
                } catch (error) {
                    console.error('Failed to subscribe to chat:', error);
                }
            };
            
            setupSubscription();
        }

        // Subscribe to user status updates
        const handleUserStatusUpdate = (statusUpdate) => {
          const { userId, isOnline } = statusUpdate;
          setUserStatuses(prev => ({
            ...prev,
            [userId]: isOnline
          }));
          
          // Update participants with new status
          setParticipants(prev => ({
            ...prev,
            [userId]: prev[userId] ? {
              ...prev[userId],
              isOnline
            } : prev[userId]
          }));
        };

        // Connect to user status WebSocket and subscribe (only if not globally subscribed)
        if (!isGloballySubscribed) {
          userStatusWebSocketService.connect()
            .then(() => {
              const statusUnsubscribe = userStatusWebSocketService.addStatusUpdateCallback(handleUserStatusUpdate);
              // Store status unsubscribe for cleanup
              if (statusUnsubscribe) {
                unsubscribe = (() => {
                  if (typeof unsubscribe === 'function') unsubscribe();
                  statusUnsubscribe();
                });
              }
            })
            .catch(error => {
              console.warn('Failed to connect to user status WebSocket:', error);
            });
        }

        return () => {
            if (unsubscribe && typeof unsubscribe === 'function') {
                unsubscribe();
            }
        };
    }, [chatId, currentUserId, onMessageReceived, isGloballySubscribed]);

    // Handle incoming messages from parent component (when globally subscribed)
    useEffect(() => {
        // console.log('Incoming message from parent:', incomingMessage);
        if (isGloballySubscribed && incomingMessage && incomingMessage.chatId === chatId) {
            // console.log('Incoming message:', incomingMessage);
            if (incomingMessage.type === 'MESSAGE_DELETED') {
                console.log("msg deleted in Global");
                setMessages(prev => prev.filter(
                    msg => msg.messageId !== incomingMessage.messageId
                ));
                if (onMessageReceived) onMessageReceived(chatId, incomingMessage.latestMessage);
            } 
            else if (incomingMessage.type === 'MESSAGE_EDITED') {
                console.log("msg edited in Global");
                setMessages(prev => prev.map(msg => 
                    msg.messageId === incomingMessage.messageId ? incomingMessage : msg
                ));
                if (onMessageReceived) onMessageReceived(chatId, incomingMessage.latestMessage);

            }
            else {
                console.log("msg sent in Global");
                // Prevent duplicate messages by checking if message already exists
                setMessages(prev => {
                    const messageExists = prev.some(msg => msg.messageId === incomingMessage.messageId);
                    if (messageExists) {
                        return prev;
                    }
                    return [...prev, incomingMessage];
                });
                
                // Mark as read if user is at bottom when new message arrives
                if (incomingMessage.senderId !== currentUserId) {
                    setHasUnreadMessages(true);
                }
            }
        }
    }, [incomingMessage, chatId, currentUserId, isGloballySubscribed]);

    // Context menu handlers
    const handleContextMenu = (e, message) => {
        e.preventDefault();
        setContextMenu({
            show: true,
            x: e.clientX,
            y: e.clientY,
            message
        });
    };

    // Scroll to bottom functionality
    const scrollToBottom = useCallback(() => {
        if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTo({
                top: messagesContainerRef.current.scrollHeight,
                behavior: 'smooth'
            });
        }
    }, []);

    // Setup IntersectionObserver to detect if user is at bottom
    useEffect(() => {
        if (!bottomElementRef.current) return;

        observerRef.current = new IntersectionObserver(
            ([entry]) => {
                const atBottom = entry.isIntersecting;
                setIsAtBottom(atBottom);
                if (onBottomStateChange) {
                    onBottomStateChange(atBottom);
                }
                if (atBottom) {
                    setShowNewMessageIndicator(false);
                }
            },
            { threshold: 0.1 }
        );

        observerRef.current.observe(bottomElementRef.current);

        return () => {
            if (observerRef.current) {
                observerRef.current.disconnect();
            }
        };
    }, []);

    // Setup IntersectionObserver to detect if user scrolled to top (for loading older messages)
    useEffect(() => {
        if (!topElementRef.current) return;

        topObserverRef.current = new IntersectionObserver(
            ([entry]) => {
                // console.log("Top observer triggered:", {
                //     isIntersecting: entry.isIntersecting,
                //     hasMoreMessages,
                //     isLoadingMore,
                //     isLoading
                // });
                
                if (entry.isIntersecting && hasMoreMessages && !isLoadingMore && !isLoading) {
                    // console.log("Triggering loadMoreMessages");
                    loadMoreMessages();
                }
            },
            { threshold: 0.1, root: messagesContainerRef.current, rootMargin: "200px 0px 0px 0px" }
        );

        // Only observe if we have more messages and aren't loading
        if (hasMoreMessages && !isLoadingMore && !isLoading) {
            topObserverRef.current.observe(topElementRef.current);
        }

        return () => {
            if (topObserverRef.current) {
                topObserverRef.current.disconnect();
            }
        };
    }, [hasMoreMessages, isLoadingMore, isLoading, loadMoreMessages]);

    // Auto-scroll when new messages arrive (only if user is at bottom)
    useEffect(() => {
        // console.log("Auto-scroll when new messages arrive (only if user is at bottom), isAtBottom:", isAtBottom);
        if (messages.length > 0) {
            if (isAtBottom) {
                // User is at bottom, auto-scroll and mark as read
                setTimeout(scrollToBottom, 100);
                setTimeout(markMessagesAsRead, 200);
            } else {
                // User is not at bottom, show indicator
                setShowNewMessageIndicator(true);
            }
        }
    }, [messages.length, isAtBottom, scrollToBottom, markMessagesAsRead]);

    // Mark as read when user reaches bottom
    useEffect(() => {
        if (isAtBottom && hasUnreadMessages) {
            markMessagesAsRead();
        }
    }, [isAtBottom, markMessagesAsRead, hasUnreadMessages]);

    // Mark as read when chat is first loaded with unread messages
    useEffect(() => {
        if (!isLoading && hasUnreadMessages && isAtBottom) {
            setTimeout(markMessagesAsRead, 500);
        }
    }, [isLoading, hasUnreadMessages, isAtBottom, markMessagesAsRead]);

    // Scroll to bottom only on initial load (not when loading more messages)
    const initialLoadRef = useRef(true);
    
    useEffect(() => {
        if (!isLoading && messages.length > 0 && initialLoadRef.current) {
            // console.log("Initial load - scrolling to bottom");
            initialLoadRef.current = false;
            setTimeout(scrollToBottom, 100);
        }
    }, [isLoading, messages.length, scrollToBottom]);


    const hideContextMenu = () => {
        setContextMenu({ show: false, x: 0, y: 0, message: null });
    };

    // Handle clicking on chat to scroll to bottom
    const handleChatClick = () => {
        scrollToBottom();
        setShowNewMessageIndicator(false);
    };

    // Edit message functions
    const handleEdit = (message) => {
        if (onEditMessage) {
            onEditMessage(message);
        }
        hideContextMenu();
    };

    // Delete message functions
    const handleDelete = (messageId) => {
        setDeleteDialog({ show: true, messageId });
        hideContextMenu();
    };

    const deleteMsg = async (messageId) => {
        try {
            await messagesAPI.deleteMessage(messageId);
            
            // Update local state
            setMessages(prev => prev.filter(msg => msg.messageId !== messageId));
            
        } catch (error) {
            console.error("Failed to delete message:", error);
            toast({ title: "Failed to delete message", variant: "destructive" });
        }
    };

    const handleDeleteConfirm = () => {
        deleteMsg(deleteDialog.messageId);
        setDeleteDialog({ show: false, messageId: null });
    };

    // Copy message function
    const handleCopy = async (message) => {
        try {
            const textToCopy = message.content || message.attachmentName || '';
            await navigator.clipboard.writeText(textToCopy);
            // toast({ title: "Message copied to clipboard" });
        } catch (error) {
            console.error("Failed to copy message:", error);
            // toast({ title: "Failed to copy message", variant: "destructive" });
        }
        hideContextMenu();
    };

    function formatTimestamp(timestamp) {
        if (!timestamp || typeof timestamp.seconds !== 'number') return '';
        const date = new Date(timestamp.seconds * 1000);
        return date.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit', 
            hour12: true 
        });
    }

    function formatDateHeader(timestamp) {
        if (!timestamp || typeof timestamp.seconds !== 'number') return '';
        const date = new Date(timestamp.seconds * 1000);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (date.toDateString() === today.toDateString()) {
            return 'Today';
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday';
        } else {
            return date.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
        }
    }

    function groupMessagesByDate(messages) {
        const groups = [];
        let currentDate = null;
        let currentGroup = [];

        messages.forEach(message => {
            if (!message?.sentAt) return;
            
            const messageDate = new Date(message.sentAt.seconds * 1000).toDateString();
            
            if (currentDate !== messageDate) {
                if (currentGroup.length > 0) {
                    groups.push({ date: currentDate, messages: currentGroup });
                }
                currentDate = messageDate;
                currentGroup = [message];
            } else {
                currentGroup.push(message);
            }
        });

        if (currentGroup.length > 0) {
            groups.push({ date: currentDate, messages: currentGroup });
        }

        return groups;
    }

    // Close context menu when clicking outside
    useEffect(() => {
        const handleClickOutside = () => hideContextMenu();
        if (contextMenu.show) {
            document.addEventListener('click', handleClickOutside);
            return () => document.removeEventListener('click', handleClickOutside);
        }
    }, [contextMenu.show]);


    return (
        <div className="relative flex-1 h-0" 
            style={{ backgroundImage: `url(${chatBackground})`, backgroundSize: "cover", backgroundPosition: "center" }}>
            <div 
                ref={messagesContainerRef}
                className="absolute inset-0 overflow-y-auto p-4 space-y-4 scroll-smooth"
                onClick={handleChatClick}
            >
                {/* Top loading indicator and intersection observer */}
                <div ref={topElementRef} className="h-1">
                    {isLoadingMore && (
                        <div className="flex justify-center py-2">
                            <div className="text-sm text-muted-foreground">Loading older messages...</div>
                        </div>
                    )}
                </div>

                {groupMessagesByDate(messages).map((group, groupIndex) => (
                    <div key={groupIndex}>
                        {/* Date Header */}
                        <div className="flex justify-center my-6">
                            <div className="bg-muted text-muted-foreground px-3 py-1 rounded-full text-xs font-medium">
                                {formatDateHeader({ seconds: new Date(group.date).getTime() / 1000 })}
                            </div>
                        </div>

                        {/* Messages for this date */}
                        {group.messages.map((message, index) => {
                            if (!message) return null; // Defensive check
                            const isCurrentUser = message.senderId === currentUserId;

                            return (
                                <div
                                    key={message.messageId ? `msg-${message.messageId}` : `temp-${groupIndex}-${index}-${message.content?.substring(0,10) || 'empty'}`}
                                    data-message-id={message.messageId}
                                    className={`flex items-end gap-3 mb-4 ${isCurrentUser ? 'justify-end text-right' : 'justify-start'}`}
                                >
                                    {!isCurrentUser && (
                                        <div className="relative">
                                            <Avatar 
                                              className="h-10 w-10 cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all"
                                            //   onClick={() => navigate(`/user/${message.senderId}`)}
                                            >
                                                <AvatarImage src={participants[message.senderId]?.avatarUrl || avatarPlaceholder} />
                                                <AvatarFallback className="text-xs">
                                                    {participants[message.senderId]?.firstName?.split(' ').map(n => n[0]).join('') || ''}
                                                </AvatarFallback>
                                            </Avatar>
                                            {participants[message.senderId]?.isOnline === true && (
                                                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-background"></div>
                                            )}
                                        </div>
                                    )}
                                    
                                    <div
                                        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl cursor-pointer ${
                                            isCurrentUser 
                                                ? 'bg-primary text-primary-foreground' 
                                                : 'bg-muted text-foreground'
                                        }`}
                                        onContextMenu={(e) => handleContextMenu(e, message)}
                                    >
                                        {/* Show image or file link if attachment exists */}
                                        {message.attachment && (
                                            message.attachment.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
                                                <img
                                                    src={message.attachment}
                                                    alt="attachment"
                                                    className="mt-2 w-28 h-28 object-cover rounded-lg border border-border"
                                                />
                                            ) : (
                                                <a
                                                    href={message.attachment}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className={`block mt-2 text-sm truncate underline hover:opacity-80 ${
                                                        isCurrentUser ? 'text-primary-foreground/80' : 'text-primary'
                                                    }`}
                                                >
                                                    {message.attachmentName}
                                                </a>
                                            )
                                        )}

                                        <p className="text-sm">{message.content}</p>

                                        <div className={`flex items-center justify-between mt-1 ${
                                            isCurrentUser ? 'text-primary-foreground/70' : 'text-muted-foreground'
                                        }`}>
                                            <p className="text-xs">
                                                {message.editedAt 
                                                    ? `Edited: ${formatTimestamp(message.editedAt)}` 
                                                    : formatTimestamp(message.sentAt)
                                                }
                                            </p>
                                            
                                            {/* Message Status Indicators - only for current user messages */}
                                            {isCurrentUser && (
                                                <div className="flex items-center ml-2">
                                                    {message.status === 'sending' && (
                                                        <Check className="h-3 w-3 text-gray-500 animate-pulse" />
                                                    )}
                                                    {message.status === 'delivered' && (
                                                        <CheckCheck className="h-3 w-3 text-gray-500" />
                                                    )}
                                                    {message.readBy !=null && message.readBy?.includes(currentUserId) && (
                                                        <CheckCheck className="h-3 w-3 text-white-500" />
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ))}

                {/* Bottom element for IntersectionObserver */}
                <div ref={bottomElementRef} className="h-1" />
            </div>

            {/* New Message Indicator */}
            {showNewMessageIndicator && (
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
                    <Button
                        onClick={handleChatClick}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-4 py-2 shadow-lg flex items-center gap-2 animate-bounce"
                    >
                        <ChevronDown className="h-4 w-4" />
                    </Button>
                </div>
            )}

            {/* Context Menu */}
            {contextMenu.show && (
                <div
                    className="fixed bg-white border border-gray-200 rounded-lg shadow-lg py-2 z-50"
                    style={{
                        left: contextMenu.x,
                        top: contextMenu.y,
                    }}
                >
                    {contextMenu.message.senderId === currentUserId && (
                        <>
                            <button
                                onClick={() => handleEdit(contextMenu.message)}
                                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                            >
                                <Edit3 className="h-4 w-4 text-blue-500" />
                                Edit
                            </button>
                            <button
                                onClick={() => handleDelete(contextMenu.message.messageId)}
                                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                            >
                                <Trash2 className="h-4 w-4 text-red-500" />
                                Delete
                            </button>
                        </>
                    )}
                    <button
                        onClick={() => handleCopy(contextMenu.message)}
                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                        <Copy className="h-4 w-4 text-green-500" />
                        Copy
                    </button>
                </div>
            )}


            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteDialog.show} onOpenChange={(open) => !open && setDeleteDialog({ show: false, messageId: null })}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Message</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this message? This action cannot be undone and all users in the chat will no longer see this message.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setDeleteDialog({ show: false, messageId: null })}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-600 hover:bg-red-700">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

        </div>
    );
}