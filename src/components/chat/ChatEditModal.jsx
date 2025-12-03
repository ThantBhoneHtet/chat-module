import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { ScrollArea } from './ui/scroll-area';
import { Checkbox } from './ui/checkbox';
import { UserPlus, LogOut, Trash2, X, Loader2, Users, Edit2, ImagePlus, Search, MessageCircle } from 'lucide-react';
import { chatAPI, messagesAPI } from '../../rest-api/services/messages';
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
  onLeaveChat,
  onNavigateToChat
}) {
  const [isAddMemberMode, setIsAddMemberMode] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [currentParticipants, setCurrentParticipants] = useState([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ show: false, type: null, memberId: null });
  
  // Edit group state
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupImage, setEditGroupImage] = useState(null);
  const [editGroupImagePreview, setEditGroupImagePreview] = useState(null);
  
  // Search state for add member
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const isGroupChat = chat?.type === 'GROUP';
  const isOwner = chat?.owner === currentUser?.userId;

  // Load current participants when modal opens
  useEffect(() => {
    if (open && chat?.chatId && !chat?.isTemporary) {
      loadParticipants();
      if (isGroupChat) {
        setEditGroupName(chat.groupName || '');
        setEditGroupImagePreview(chat.gpImageUrl || null);
      }
    }
  }, [open, chat?.chatId]);

  // Debounced search for members
  useEffect(() => {
    const searchTimeout = setTimeout(async () => {
      if (memberSearchQuery.trim().length > 0) {
        setIsSearching(true);
        try {
          const results = await usersAPI.searchUsers(memberSearchQuery.trim());
          // Filter out current user and existing participants
          const currentParticipantIds = new Set(chat?.participants || []);
          const filtered = (results || []).filter(
            user => user.userId !== currentUser?.userId && !currentParticipantIds.has(user.userId)
          );
          setSearchResults(filtered);
        } catch (error) {
          console.error('Error searching users:', error);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [memberSearchQuery, chat?.participants, currentUser?.userId]);

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

  // Get members to show in add mode (search results + existing contacts not in group)
  const availableMembersToAdd = useMemo(() => {
    const currentParticipantIds = new Set(chat?.participants || []);
    
    // If searching, return search results
    if (memberSearchQuery.trim()) {
      return searchResults;
    }
    
    // Otherwise, show existing direct chat contacts not in the group
    if (!isGroupChat) return [];
    
    const members = [];
    const seenIds = new Set();
    
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
  }, [existingChats, chat?.participants, isGroupChat, memberSearchQuery, searchResults]);

  // Toggle member selection
  const toggleMember = (userId) => {
    setSelectedMembers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  // Handle member click to navigate to direct chat
  const handleMemberClick = async (member) => {
    if (member.id === currentUser?.userId) return;
    
    // Check if chat exists
    const existingChatId = await chatAPI.checkChatExists([currentUser.userId, member.id]);
    
    if (existingChatId) {
      onNavigateToChat?.(existingChatId);
    } else {
      // Create temporary chat structure for navigation
      const tempChat = {
        chatId: `temp-${Date.now()}`,
        type: 'DIRECT',
        participants: [currentUser.userId, member.id],
        isTemporary: true,
        otherParticipant: {
          id: member.id,
          firstName: member.firstName,
          lastName: member.lastName,
          avatarUrl: member.avatarUrl,
          isOnline: member.isOnline
        }
      };
      onNavigateToChat?.(null, tempChat);
    }
    onOpenChange(false);
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
      setMemberSearchQuery('');
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

  // Leave chat (group only)
  const handleLeaveChat = async () => {
    setIsUpdating(true);
    try {
      const updatedParticipantIds = (chat.participants || []).filter(id => id !== currentUser.userId);
      await chatAPI.updateParticipants(chat.chatId, updatedParticipantIds);
      
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

  // Delete chat (both direct and group owner)
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
      setIsUpdating(true);
      setConfirmDialog({ show: false, type: null, memberId: null });
    }
  };

  // Handle group image change
  const handleGroupImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size must be less than 5MB');
        return;
      }
      setEditGroupImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditGroupImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Save group changes
  const handleSaveGroupChanges = async () => {
    if (!editGroupName.trim()) {
      toast.error('Please enter a group name');
      return;
    }

    setIsUpdating(true);
    try {
      let imageUrl = chat.gpImageUrl || null;
      
      // Upload image to S3 if new image selected
      if (editGroupImage) {
        const formData = new FormData();
        formData.append('attachment', editGroupImage);
        imageUrl = await messagesAPI.uploadAttachment(chat.chatId, formData);
      }

      const gpChatEditDto = {
        name: editGroupName.trim(),
        gpImageUrl: imageUrl
      };

      await chatAPI.updateGroupChat(chat.chatId, gpChatEditDto);
      
      toast.success('Group updated successfully!');
      onChatUpdated?.({ 
        ...chat, 
        groupName: editGroupName.trim(),
        gpImageUrl: imageUrl
      });
      setIsEditMode(false);
    } catch (error) {
      console.error('Error updating group:', error);
      toast.error('Failed to update group');
    } finally {
      setIsUpdating(false);
    }
  };

  // Reset state when modal closes
  const handleOpenChange = (isOpen) => {
    if (!isOpen) {
      setIsAddMemberMode(false);
      setIsEditMode(false);
      setSelectedMembers([]);
      setMemberSearchQuery('');
      setEditGroupImage(null);
    }
    onOpenChange(isOpen);
  };

  if (!chat) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                {isGroupChat ? chat.groupName : 'Chat Options'}
              </div>
              {isGroupChat && isOwner && !isAddMemberMode && !isEditMode && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsEditMode(true)}
                  className="h-8 w-8"
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Edit Group Mode (Owner only) */}
            {isGroupChat && isEditMode && (
              <div className="space-y-4">
                {/* Group Image */}
                <div className="flex justify-center">
                  <div className="relative">
                    <div 
                      className="h-20 w-20 rounded-full bg-muted flex items-center justify-center cursor-pointer overflow-hidden border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 transition-colors"
                      onClick={() => document.getElementById('edit-group-image-input').click()}
                    >
                      {editGroupImagePreview ? (
                        <img 
                          src={editGroupImagePreview} 
                          alt="Group" 
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <ImagePlus className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    {editGroupImagePreview && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditGroupImage(null);
                          setEditGroupImagePreview(null);
                        }}
                        className="absolute -top-1 -right-1 h-5 w-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:bg-destructive/90"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                    <input
                      id="edit-group-image-input"
                      type="file"
                      accept="image/*"
                      onChange={handleGroupImageChange}
                      className="hidden"
                    />
                  </div>
                </div>

                {/* Group Name */}
                <Input
                  placeholder="Group name"
                  value={editGroupName}
                  onChange={(e) => setEditGroupName(e.target.value)}
                  maxLength={50}
                />

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsEditMode(false);
                      setEditGroupName(chat.groupName || '');
                      setEditGroupImage(null);
                      setEditGroupImagePreview(chat.gpImageUrl || null);
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveGroupChanges}
                    disabled={isUpdating || !editGroupName.trim()}
                    className="flex-1"
                  >
                    {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                  </Button>
                </div>
              </div>
            )}

            {/* Group Chat - Members Section */}
            {isGroupChat && !isAddMemberMode && !isEditMode && (
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
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-accent group"
                        >
                          <div 
                            className={`flex items-center gap-3 flex-1 ${member.id !== currentUser?.userId ? 'cursor-pointer' : ''}`}
                            onClick={() => member.id !== currentUser?.userId && handleMemberClick(member)}
                          >
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
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">
                                {member.firstName} {member.lastName}
                                {member.id === currentUser?.userId && ' (You)'}
                              </span>
                              {member.id === chat.owner && (
                                <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">
                                  Owner
                                </span>
                              )}
                            </div>
                            {member.id !== currentUser?.userId && (
                              <MessageCircle className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-auto mr-2" />
                            )}
                          </div>
                          
                          {/* Kick button (owner only, can't kick self) */}
                          {isOwner && member.id !== currentUser?.userId && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDialog({ show: true, type: 'kick', memberId: member.id });
                              }}
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
                      setMemberSearchQuery('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>

                {/* Search bar */}
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users..."
                    value={memberSearchQuery}
                    onChange={(e) => setMemberSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                  {isSearching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
                
                <ScrollArea className="h-[180px] border rounded-lg">
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
                        <p className="text-sm">
                          {memberSearchQuery ? 'No users found' : 'Search for users to add'}
                        </p>
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
            {!isAddMemberMode && !isEditMode && (
              <div className="space-y-2 pt-2 border-t">
                {/* Direct Chat - Delete option for both users */}
                {!isGroupChat && (
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setConfirmDialog({ show: true, type: 'delete', memberId: null })}
                    disabled={isUpdating}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Chat
                  </Button>
                )}

                {/* Group Chat - Leave option */}
                {isGroupChat && (
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setConfirmDialog({ show: true, type: 'leave', memberId: null })}
                    disabled={isUpdating}
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Leave Group
                  </Button>
                )}

                {/* Delete and Leave (Group owner only) */}
                {isGroupChat && isOwner && (
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setConfirmDialog({ show: true, type: 'delete', memberId: null })}
                    disabled={isUpdating}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Group
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
              {confirmDialog.type === 'leave' && 'Leave Group'}
              {confirmDialog.type === 'delete' && (isGroupChat ? 'Delete Group' : 'Delete Chat')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.type === 'kick' && 'Are you sure you want to remove this member from the group?'}
              {confirmDialog.type === 'leave' && 'Are you sure you want to leave this group?'}
              {confirmDialog.type === 'delete' && (
                isGroupChat 
                  ? 'Are you sure you want to delete this group? This action cannot be undone.'
                  : 'Are you sure you want to delete this chat? This will delete the chat for both users.'
              )}
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
