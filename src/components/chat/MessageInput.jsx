import React, { useState, useRef, useEffect } from 'react';
import { Search, Image, Send, Paperclip, MoreVertical, X } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { messagesAPI, websocketAPI } from '../../rest-api/services/messages';

export function MessageInput({ chatId, onSend, editingMessage, onCancelEdit }) {
    const [messageText, setMessageText] = useState('');
    const [attachment, setAttachment] = useState(null);
    const [attachmentPreview, setAttachmentPreview] = useState(null);
    const fileInputRef = useRef(null);
    const imageInputRef = useRef(null);
    
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    const currentUserId = currentUser.id || '';

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

        if (editingMessage) {
            // Check if content is the same as original
            const originalContent = editingMessage.content || '';
            const originalAttachment = editingMessage.attachment || null;
            
            if (messageText === originalContent && attachmentPreview === originalAttachment && !attachment) {
                // No changes, cancel edit
                onCancelEdit();
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
                    return;
                }
            }

            const message = {
                senderId: currentUserId,
                content: messageText,
                attachmentUrl: attachmentUrl,
                attachmentName: attachment?.name
            };

            if (websocketAPI.sendMessage(chatId, message)) {
                setMessageText('');
                setAttachment(null);
                setAttachmentPreview(null);
                if (onSend) onSend(message);
            }
        }
    };


    return (
        <div className="p-4 border-t bg-white">
            {/* Edit indicator */}
            {editingMessage && (
                <div className="mb-3 flex items-center justify-between p-2 bg-blue-50 border border-blue-200 rounded-lg">
                    <span className="text-sm text-blue-700">
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
                        className="absolute top-1 right-1 bg-gray-800 text-white rounded-full p-1 hover:bg-gray-700"
                    >
                        ×
                    </button>
                </div>
            )}
            {attachment && !attachmentPreview && (
                <div className="relative mb-2 flex items-center gap-2 p-2 bg-gray-100 rounded-lg max-w-xs">
                    <span className="truncate">{attachment.name}</span>
                    <button
                        onClick={removeAttachment}
                        className="text-gray-500 hover:text-gray-700"
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
                >
                    <Paperclip className="h-5 w-5" />
                </Button>
                <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={prepareImageUpload}
                >
                    <Image className="h-5 w-5" />
                </Button>
                <div className="flex-1">
                    <Input
                        placeholder="Type a message..."
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        className="border-0 bg-gray-100 focus:bg-white"
                    />
                </div>
                <Button 
                    size="icon"              
                    onClick={handleSendMessage}
                    disabled={!messageText.trim() && !attachment}
                >
                    <Send className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}