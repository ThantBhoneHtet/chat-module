import React, { useState, useRef, useEffect } from 'react';
import { Search, Image, Send, Paperclip, MoreVertical, X, Reply, FileText } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { messagesAPI, websocketAPI, chatAPI } from '../../rest-api/services/messages';
import { toast } from 'sonner';

export function MessageInput({ 
    chatId, 
    onSend, 
    editingMessage, 
    onCancelEdit,
    replyingTo,
    onCancelReply,
    isTemporaryChat = false,
    tempChatData = null,
    onFirstMessageSent = null,
    currentUserId = null
}) {
    const [messageText, setMessageText] = useState('');
    const [attachment, setAttachment] = useState(null);
    const [attachmentPreview, setAttachmentPreview] = useState(null);
    const [isSending, setIsSending] = useState(false);
    const fileInputRef = useRef(null);
    const imageInputRef = useRef(null);
    
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    const userId = currentUserId || currentUser?.id || '';

    // Populate fields when editing a message
    useEffect(() => {
        if (editingMessage) {
            setMessageText(editingMessage.content || '');
            if (editingMessage.attachment) {
                // For editing, set attachment URL directly for preview
                if (editingMessage.attachment.match(/\.(jpeg|jpg|gif|png|webp)$/i)) {
                    setAttachmentPreview(editingMessage.attachment);
                } else {
                    setAttachment({ name: editingMessage.attachmentName });
                }
            }
        } else {
            // Clear fields when not editing
            setMessageText('');
            setAttachment(null);
            setAttachmentPreview(null);
        }
    }, [editingMessage]);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            setAttachmentPreview(file.type.startsWith('image/') ? event.target.result : null);
        };
        reader.readAsDataURL(file);
        setAttachment(file);
    };

    const prepareFileUpload = () => {
        fileInputRef.current.click();
    };

    const prepareImageUpload = () => {
        imageInputRef.current.click();
    };

    const removeAttachment = () => {
        setAttachment(null);
        setAttachmentPreview(null);
    };

    const handleSendMessage = async () => {
        if (!messageText.trim() && !attachment) return;
        if (isSending) return;

        setIsSending(true);

        try {
            if (editingMessage) {
                // Check if content is the same as original
                const originalContent = editingMessage.content || '';
                const originalAttachment = editingMessage.attachment || null;
                
                if (messageText === originalContent && attachmentPreview === originalAttachment && !attachment) {
                    // No changes, cancel edit
                    onCancelEdit();
                    setIsSending(false);
                    return;
                }

                let attachmentUrl = originalAttachment;

                // If new attachment is uploaded (not just preview)
                if (attachment && attachment instanceof File) {
                    const formData = new FormData();
                    formData.append('attachment', attachment);

                    try {
                        attachmentUrl = await messagesAPI.uploadAttachment(chatId, formData);
                    } catch (error) {
                        console.error('Upload failed:', error);
                        setIsSending(false);
                        return;
                    }
                }

                try {
                    const updatedMessage = await messagesAPI.editMessage(editingMessage.messageId, {
                        content: messageText,
                        attachment: attachmentUrl,
                        attachmentName: attachment?.name || editingMessage.attachmentName
                    });
                    
                    // Clear fields and exit edit mode
                    setMessageText('');
                    setAttachment(null);
                    setAttachmentPreview(null);
                    onCancelEdit();
                } catch (error) {
                    console.error('Failed to edit message:', error);
                }
            } else if (isTemporaryChat && tempChatData) {
                // Handle first message in temporary chat - create real chat first
                try {
                    // Create real chat via API
                    const chatRequest = {
                        type: 'DIRECT',
                        participantIds: tempChatData.participants
                    };
                    
                    const newChat = await chatAPI.createChat(chatRequest);
                    
                    // Upload attachment if present
                    let attachmentUrl = null;
                    if (attachment) {
                        const formData = new FormData();
                        formData.append('attachment', attachment);
                        attachmentUrl = await messagesAPI.uploadAttachment(newChat.chatId, formData);
                    }

                    // Send message to the new chat
                    const message = {
                        senderId: userId,
                        content: messageText,
                        attachmentUrl: attachmentUrl,
                        attachmentName: attachment?.name
                    };

                    // Connect and send via WebSocket
                    await websocketAPI.connect();
                    websocketAPI.sendMessage(newChat.chatId, message);

                    // Clear fields
                    setMessageText('');
                    setAttachment(null);
                    setAttachmentPreview(null);

                    // Enhance chat with other participant info
                    const enhancedChat = {
                        ...newChat,
                        otherParticipant: tempChatData.otherParticipant,
                        lastMessage: messageText,
                        lastMessageTime: { seconds: Date.now() / 1000 }
                    };

                    // Notify parent to replace temp chat with real one
                    if (onFirstMessageSent) {
                        onFirstMessageSent(chatId, enhancedChat);
                    }

                    toast.success('Conversation started!');
                    
                } catch (error) {
                    console.error('Failed to create chat:', error);
                    toast.error('Failed to start conversation. Please try again.');
                }
            } else {
                // Normal send message logic
                let attachmentUrl = null;

                if (attachment) {
                    const formData = new FormData();
                    formData.append('attachment', attachment);

                    try {
                        attachmentUrl = await messagesAPI.uploadAttachment(chatId, formData);
                    } catch (error) {
                        console.error('Upload failed:', error);
                        setIsSending(false);
                        return;
                    }
                }

                const message = {
                    senderId: userId,
                    content: messageText,
                    attachmentUrl: attachmentUrl,
                    attachmentName: attachment?.name,
                    replyToMessageId: replyingTo?.messageId || null
                };

                if (websocketAPI.sendMessage(chatId, message)) {
                    setMessageText('');
                    setAttachment(null);
                    setAttachmentPreview(null);
                    if (onCancelReply) onCancelReply();
                    if (onSend) onSend(message);
                }
            }
        } finally {
            setIsSending(false);
        }
    };


    return (
        <div className="p-4 border-t bg-card">
            {/* Edit indicator */}
            {editingMessage && (
                <div className="mb-3 flex items-center justify-between p-2 bg-primary/10 border border-primary/20 rounded-lg">
                    <span className="text-sm text-primary">
                        Editing message
                    </span>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onCancelEdit}
                        className="h-6 w-6 p-0"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            )}

            {/* Reply indicator */}
            {replyingTo && !editingMessage && (
                <div className="mb-3 flex items-center justify-between p-2 bg-primary/10 border-l-2 border-primary rounded-lg">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Reply className="h-4 w-4 text-primary flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                            <span className="text-xs font-medium text-primary block">
                                Replying to message
                            </span>
                            <div className="flex items-center gap-1">
                                {replyingTo.attachment && (
                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                        {replyingTo.attachment.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
                                            <>
                                                <Image className="h-3 w-3" />
                                                Photo
                                            </>
                                        ) : (
                                            <>
                                                <FileText className="h-3 w-3" />
                                                {replyingTo.attachmentName}
                                            </>
                                        )}
                                        {replyingTo.content && ' • '}
                                    </span>
                                )}
                                {replyingTo.content && (
                                    <span className="text-xs text-muted-foreground truncate">
                                        {replyingTo.content}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onCancelReply}
                        className="h-6 w-6 p-0 flex-shrink-0"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            )}
            
            {/* Hidden file inputs */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                style={{ display: 'none' }}
                 accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.zip,.csv"
            />
            <input
                type="file"
                ref={imageInputRef}
                onChange={handleFileChange}
                style={{ display: 'none' }}
                accept="image/*" // Accept only images
            />
            
            {/* Attachment preview */}
            {attachmentPreview && (
                <div className="relative mb-2 max-w-xs">
                    <img 
                        src={attachmentPreview} 
                        alt="Attachment preview" 
                        className="rounded-lg max-h-32"
                    />
                    <button
                        onClick={removeAttachment}
                        className="absolute top-1 right-1 bg-foreground/80 text-background rounded-full p-1 hover:bg-foreground/70"
                    >
                        ×
                    </button>
                </div>
            )}
            {attachment && !attachmentPreview && (
                <div className="relative mb-2 flex items-center gap-2 p-2 bg-muted rounded-lg max-w-xs">
                    <span className="truncate text-foreground">{attachment.name}</span>
                    <button
                        onClick={removeAttachment}
                        className="text-muted-foreground hover:text-foreground"
                    >
                        ×
                    </button>
                </div>
            )}
            
            {/* Input area */}
            <div className="flex items-center space-x-3">
                <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={prepareFileUpload}
                    disabled={isSending}
                >
                    <Paperclip className="h-5 w-5" />
                </Button>
                <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={prepareImageUpload}
                    disabled={isSending}
                >
                    <Image className="h-5 w-5" />
                </Button>
                <div className="flex-1">
                    <Input
                        placeholder={isTemporaryChat ? "Say something..." : "Type a message..."}
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && !isSending && handleSendMessage()}
                        className="border-0 bg-muted focus:bg-background"
                        disabled={isSending}
                    />
                </div>
                <Button 
                    size="icon"              
                    onClick={handleSendMessage}
                    disabled={(!messageText.trim() && !attachment) || isSending}
                >
                    {isSending ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    ) : (
                        <Send className="h-4 w-4" />
                    )}
                </Button>
            </div>
        </div>
    );
}