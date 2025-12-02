import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { ScrollArea } from './ui/scroll-area';
import { Checkbox } from './ui/checkbox';
import { UserPlus, LogOut, Trash2, X, Loader2, Users } from 'lucide-react';
import { chatAPI } from '../../rest-api/services/messages';
import { usersAPI } from '../../rest-api/services/users';
import avatarPlaceholder from '../../assets/avatar.jpg';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';

export function ChatEditModal({ 
  open, 
  onOpenChange, 
  chat,
  currentUser,
  existingChats = [],
  onChatUpdated,
  onLeaveChat
}) {
  const [isAddMemberMode, setIsAddMemberMode] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [currentParticipants, setCurrentParticipants] = useState([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ show: false, type: null, memberId: null });

  const isGroupChat = chat?.type === 'GROUP';
  const isOwner = chat?.owner === currentUser?.userId;

  // Load current participants when modal opens
  useEffect(() => {
    if (open && chat?.chatId && !chat?.isTemporary) {
      loadParticipants();
    }
  }, [open, chat?.chatId]);

  const loadParticipants = async () => {
    setIsLoadingParticipants(true);
    try {
      const participants = await chatAPI.getChatParticipants(chat.chatId);
      setCurrentParticipants(participants || []);
    } catch (error) {
      console.error('Error loading participants:', error);
      toast.error('Failed to load participants');
    } finally {
      setIsLoadingParticipants(false);
    }
  };

  // Get unique users from existing direct chats who are NOT already in the group
  const availableMembersToAdd = useMemo(() => {
    if (!isGroupChat) return [];
    
    const members = [];
    const seenIds = new Set();
    const currentParticipantIds = new Set(chat?.participants || []);
    
    existingChats.forEach(existingChat => {
      if (existingChat.type === 'DIRECT' && existingChat.otherParticipant) {
        const participant = existingChat.otherParticipant;
        if (!seenIds.has(participant.id) && !currentParticipantIds.has(participant.id)) {
          seenIds.add(participant.id);
          members.push({
            userId: participant.id,
            firstName: participant.firstName,
            lastName: participant.lastName,
            avatarUrl: participant.avatarUrl,
            isOnline: participant.isOnline
          });
        }
      }
    });
    
    return members;
  }, [existingChats, chat?.participants, isGroupChat]);

  // Toggle member selection
  const toggleMember = (userId) => {
    setSelectedMembers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  // Add selected members to group
  const handleAddMembers = async () => {
    if (selectedMembers.length === 0) {
      toast.error('Please select at least one member');
      return;
    }

    setIsUpdating(true);
    try {
      const updatedParticipantIds = [...(chat.participants || []), ...selectedMembers];
      await chatAPI.updateParticipants(chat.chatId, updatedParticipantIds);
      
      toast.success('Members added successfully!');
      onChatUpdated?.({ ...chat, participants: updatedParticipantIds });
      setSelectedMembers([]);
      setIsAddMemberMode(false);
      await loadParticipants();
    } catch (error) {
      console.error('Error adding members:', error);
      toast.error('Failed to add members');
    } finally {
      setIsUpdating(false);
    }
  };

  // Kick member from group (owner only)
  const handleKickMember = async (memberId) => {
    setIsUpdating(true);
    try {
      const updatedParticipantIds = (chat.participants || []).filter(id => id !== memberId);
      await chatAPI.updateParticipants(chat.chatId, updatedParticipantIds);
      
      toast.success('Member removed successfully!');
      onChatUpdated?.({ ...chat, participants: updatedParticipantIds });
      await loadParticipants();
    } catch (error) {
      console.error('Error removing member:', error);
      toast.error('Failed to remove member');
    } finally {
      setIsUpdating(false);
      setConfirmDialog({ show: false, type: null, memberId: null });
    }
  };

  // Leave chat
  const handleLeaveChat = async () => {
    setIsUpdating(true);
    try {
      if (isGroupChat) {
        const updatedParticipantIds = (chat.participants || []).filter(id => id !== currentUser.userId);
        await chatAPI.updateParticipants(chat.chatId, updatedParticipantIds);
      }
      
      toast.success('You have left the chat');
      onLeaveChat?.(chat.chatId);
      onOpenChange(false);
    } catch (error) {
      console.error('Error leaving chat:', error);
      toast.error('Failed to leave chat');
    } finally {
      setIsUpdating(false);
      setConfirmDialog({ show: false, type: null, memberId: null });
    }
  };

  // Delete and leave (owner only)
  const handleDeleteChat = async () => {
    setIsUpdating(true);
    try {
      await chatAPI.deleteChat(chat.chatId);
      
      toast.success('Chat deleted successfully');
      onLeaveChat?.(chat.chatId);
      onOpenChange(false);
    } catch (error) {
      console.error('Error deleting chat:', error);
      toast.error('Failed to delete chat');
    } finally {
      setIsUpdating(false);
      setConfirmDialog({ show: false, type: null, memberId: null });
    }
  };

  // Reset state when modal closes
  const handleOpenChange = (isOpen) => {
    if (!isOpen) {
      setIsAddMemberMode(false);
      setSelectedMembers([]);
    }
    onOpenChange(isOpen);
  };

  if (!chat) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              {isGroupChat ? chat.groupName : 'Chat Options'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Group Chat - Members Section */}
            {isGroupChat && !isAddMemberMode && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">
                    Members ({currentParticipants.length})
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsAddMemberMode(true)}
                    className="text-primary"
                  >
                    <UserPlus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>
                
                <ScrollArea className="h-[200px] border rounded-lg">
                  {isLoadingParticipants ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="p-2 space-y-1">
                      {currentParticipants.map((member, index) => (
                        <motion.div
                          key={member.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.03 }}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-accent"
                        >
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <Avatar className="h-9 w-9">
                                <AvatarImage src={member.avatarUrl || avatarPlaceholder} />
                                <AvatarFallback>
                                  {member.firstName?.[0]}{member.lastName?.[0]}
                                </AvatarFallback>
                              </Avatar>
                              {member.isOnline && (
                                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-green-500 border-2 border-background rounded-full" />
                              )}
                            </div>
                            <div>
                              <span className="text-sm font-medium">
                                {member.firstName} {member.lastName}
                                {member.id === currentUser?.userId && ' (You)'}
                              </span>
                              {member.id === chat.owner && (
                                <span className="ml-2 text-xs text-primary">Owner</span>
                              )}
                            </div>
                          </div>
                          
                          {/* Kick button (owner only, can't kick self) */}
                          {isOwner && member.id !== currentUser?.userId && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setConfirmDialog({ show: true, type: 'kick', memberId: member.id })}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            )}

            {/* Add Member Mode */}
            {isGroupChat && isAddMemberMode && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">
                    Add Members ({selectedMembers.length} selected)
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsAddMemberMode(false);
                      setSelectedMembers([]);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
                
                <ScrollArea className="h-[200px] border rounded-lg">
                  <AnimatePresence>
                    {availableMembersToAdd.length > 0 ? (
                      <div className="p-2 space-y-1">
                        {availableMembersToAdd.map((member, index) => (
                          <motion.div
                            key={member.userId}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.03 }}
                            onClick={() => toggleMember(member.userId)}
                            className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                              selectedMembers.includes(member.userId) 
                                ? 'bg-primary/10' 
                                : 'hover:bg-accent'
                            }`}
                          >
                            <Checkbox 
                              checked={selectedMembers.includes(member.userId)}
                              onCheckedChange={() => toggleMember(member.userId)}
                            />
                            <div className="relative">
                              <Avatar className="h-9 w-9">
                                <AvatarImage src={member.avatarUrl || avatarPlaceholder} />
                                <AvatarFallback>
                                  {member.firstName?.[0]}{member.lastName?.[0]}
                                </AvatarFallback>
                              </Avatar>
                              {member.isOnline && (
                                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-green-500 border-2 border-background rounded-full" />
                              )}
                            </div>
                            <span className="text-sm font-medium truncate">
                              {member.firstName} {member.lastName}
                            </span>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full py-8 text-muted-foreground">
                        <Users className="h-10 w-10 mb-2 opacity-50" />
                        <p className="text-sm">No contacts available to add</p>
                      </div>
                    )}
                  </AnimatePresence>
                </ScrollArea>

                <Button 
                  onClick={handleAddMembers}
                  disabled={isUpdating || selectedMembers.length === 0}
                  className="w-full mt-3"
                >
                  {isUpdating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add {selectedMembers.length} Member{selectedMembers.length !== 1 ? 's' : ''}
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Actions */}
            {!isAddMemberMode && (
              <div className="space-y-2 pt-2 border-t">
                {/* Leave Chat */}
                <Button
                  variant="ghost"
                  className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setConfirmDialog({ show: true, type: 'leave', memberId: null })}
                  disabled={isUpdating}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Leave Chat
                </Button>

                {/* Delete and Leave (Group owner only) */}
                {isGroupChat && isOwner && (
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setConfirmDialog({ show: true, type: 'delete', memberId: null })}
                    disabled={isUpdating}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete and Leave
                  </Button>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialog.show} onOpenChange={(show) => !show && setConfirmDialog({ show: false, type: null, memberId: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.type === 'kick' && 'Remove Member'}
              {confirmDialog.type === 'leave' && 'Leave Chat'}
              {confirmDialog.type === 'delete' && 'Delete Chat'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.type === 'kick' && 'Are you sure you want to remove this member from the group?'}
              {confirmDialog.type === 'leave' && 'Are you sure you want to leave this chat?'}
              {confirmDialog.type === 'delete' && 'Are you sure you want to delete this chat? This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpdating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDialog.type === 'kick') handleKickMember(confirmDialog.memberId);
                else if (confirmDialog.type === 'leave') handleLeaveChat();
                else if (confirmDialog.type === 'delete') handleDeleteChat();
              }}
              disabled={isUpdating}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default ChatEditModal;
