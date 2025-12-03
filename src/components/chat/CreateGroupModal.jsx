import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { ScrollArea } from './ui/scroll-area';
import { Checkbox } from './ui/checkbox';
import { Users, ImagePlus, X, Loader2, Search } from 'lucide-react';
import { chatAPI } from '../../rest-api/services/messages';
import { usersAPI } from '../../rest-api/services/users';
import avatarPlaceholder from '../../assets/avatar.jpg';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

export function CreateGroupModal({ 
  open, 
  onOpenChange, 
  currentUser, 
  existingChats = [],
  onGroupCreated
}) {
  const [groupName, setGroupName] = useState('');
  const [groupImage, setGroupImage] = useState(null);
  const [groupImagePreview, setGroupImagePreview] = useState(null);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Debounced search for users
  useEffect(() => {
    const searchTimeout = setTimeout(async () => {
      if (searchQuery.trim().length > 0) {
        setIsSearching(true);
        try {
          const results = await usersAPI.searchUsers(searchQuery.trim());
          // Filter out current user
          const filtered = (results || []).filter(
            user => user.userId !== currentUser?.userId
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
  }, [searchQuery, currentUser?.userId]);

  // Get members to display (search results or existing contacts)
  const availableMembers = useMemo(() => {
    // If searching, return search results
    if (searchQuery.trim()) {
      return searchResults;
    }
    
    // Otherwise, show existing direct chat contacts
    const members = [];
    const seenIds = new Set();
    
    existingChats.forEach(chat => {
      if (chat.type === 'DIRECT' && chat.otherParticipant) {
        const participant = chat.otherParticipant;
        if (!seenIds.has(participant.id)) {
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
  }, [existingChats, searchQuery, searchResults]);

  // Handle image selection
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size must be less than 5MB');
        return;
      }
      setGroupImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setGroupImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle member toggle
  const toggleMember = (userId) => {
    setSelectedMembers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  // Reset form
  const resetForm = () => {
    setGroupName('');
    setGroupImage(null);
    setGroupImagePreview(null);
    setSelectedMembers([]);
    setSearchQuery('');
    setSearchResults([]);
  };

  // Handle modal close
  const handleOpenChange = (isOpen) => {
    if (!isOpen) {
      resetForm();
    }
    onOpenChange(isOpen);
  };

  // Create group
  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      toast.error('Please enter a group name');
      return;
    }

    setIsCreating(true);
    
    try {
      // Prepare participants (current user + selected members)
      const participantIds = [currentUser.userId, ...selectedMembers];
      
      const chatRequest = {
        type: 'GROUP',
        owner: currentUser.userId,
        name: groupName.trim(),
        participantIds: participantIds
      };

      const newChat = await chatAPI.createChat(chatRequest);
      
      toast.success('Group created successfully!');
      onGroupCreated?.(newChat);
      handleOpenChange(false);
    } catch (error) {
      console.error('Error creating group:', error);
      toast.error('Failed to create group. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            New Group
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Group Image */}
          <div className="flex justify-center">
            <div className="relative">
              <div 
                className="h-24 w-24 rounded-full bg-muted flex items-center justify-center cursor-pointer overflow-hidden border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 transition-colors"
                onClick={() => document.getElementById('group-image-input').click()}
              >
                {groupImagePreview ? (
                  <img 
                    src={groupImagePreview} 
                    alt="Group" 
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ImagePlus className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              {groupImagePreview && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setGroupImage(null);
                    setGroupImagePreview(null);
                  }}
                  className="absolute -top-1 -right-1 h-6 w-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:bg-destructive/90"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              <input
                id="group-image-input"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
            </div>
          </div>

          {/* Group Name */}
          <div>
            <Input
              placeholder="Group name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="text-center"
              maxLength={50}
            />
            <p className="text-xs text-muted-foreground text-center mt-1">
              {groupName.length}/50 characters
            </p>
          </div>

          {/* Members Section */}
          <div>
            <p className="text-sm font-medium mb-2">
              Add members ({selectedMembers.length} selected)
            </p>
            
            {/* Search bar */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>

            <ScrollArea className="h-[180px] border rounded-lg">
              <AnimatePresence>
                {availableMembers.length > 0 ? (
                  <div className="p-2 space-y-1">
                    {availableMembers.map((member, index) => (
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
                      {searchQuery ? 'No users found' : 'Search for users to add'}
                    </p>
                  </div>
                )}
              </AnimatePresence>
            </ScrollArea>
          </div>

          {/* Create Button */}
          <Button 
            onClick={handleCreateGroup}
            disabled={isCreating || !groupName.trim()}
            className="w-full"
          >
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Users className="h-4 w-4 mr-2" />
                Create Group
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default CreateGroupModal;
