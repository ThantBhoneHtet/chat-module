import React, { useState, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { ScrollArea } from './ui/scroll-area';
import { Search, UserPlus, Loader2 } from 'lucide-react';
import { usersAPI } from '../../rest-api/services/users';
import { chatAPI } from '../../rest-api/services/messages';
import avatarPlaceholder from '../../assets/avatar.jpg';
import { motion, AnimatePresence } from 'framer-motion';

export function AddContactModal({ 
  open, 
  onOpenChange, 
  currentUser, 
  onSelectUser,
  existingChats = []
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Throttled search function
  const searchUsers = useCallback(async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    try {
      const results = await usersAPI.getAll({ nameKeyword: query });
      // Filter out current user from results
      const filteredResults = results.filter(user => user.userId !== currentUser?.id);
      setSearchResults(filteredResults);
    } catch (error) {
      console.error('Error searching users:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [currentUser?.id]);

  // Throttle effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchUsers(searchQuery);
    }, 300); // 300ms throttle

    return () => clearTimeout(timeoutId);
  }, [searchQuery, searchUsers]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setSearchResults([]);
      setHasSearched(false);
    }
  }, [open]);

  const handleUserClick = async (selectedUser) => {
    // Check if chat already exists between current user and selected user
    try {
      const existingChatId = await chatAPI.checkChatExists([currentUser.id, selectedUser.userId]);
      
      if (existingChatId) {
        // Chat exists, pass the chatId to open it
        onSelectUser({ 
          type: 'existing', 
          chatId: existingChatId,
          user: selectedUser 
        });
      } else {
        // Chat doesn't exist, create temporary chat
        onSelectUser({ 
          type: 'new', 
          user: selectedUser,
          tempChat: {
            chatId: `temp_${Date.now()}`,
            type: 'DIRECT',
            isTemporary: true,
            participants: [currentUser.id, selectedUser.userId],
            otherParticipant: {
              id: selectedUser.userId,
              firstName: selectedUser.firstName,
              lastName: selectedUser.lastName,
              avatarUrl: selectedUser.avatarUrl,
              isOnline: selectedUser.isOnline
            },
            lastMessage: null,
            lastMessageTime: null,
            unreadCounts: {}
          }
        });
      }
    } catch (error) {
      console.error('Error checking chat existence:', error);
      // On error, try to create new chat anyway
      onSelectUser({ 
        type: 'new', 
        user: selectedUser,
        tempChat: {
          chatId: `temp_${Date.now()}`,
          type: 'DIRECT',
          isTemporary: true,
          participants: [currentUser.id, selectedUser.userId],
          otherParticipant: {
            id: selectedUser.userId,
            firstName: selectedUser.firstName,
            lastName: selectedUser.lastName,
            avatarUrl: selectedUser.avatarUrl,
            isOnline: selectedUser.isOnline
          },
          lastMessage: null,
          lastMessageTime: null,
          unreadCounts: {}
        }
      });
    }
    
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            New Chat
          </DialogTitle>
        </DialogHeader>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            autoFocus
          />
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Results Count */}
        <AnimatePresence mode="wait">
          {hasSearched && !isSearching && (
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-sm text-muted-foreground"
            >
              {searchResults.length} user{searchResults.length !== 1 ? 's' : ''} found
            </motion.p>
          )}
        </AnimatePresence>

        {/* Search Results */}
        <ScrollArea className="max-h-[300px]">
          <AnimatePresence mode="popLayout">
            {searchResults.length > 0 ? (
              <div className="space-y-1">
                {searchResults.map((user, index) => (
                  <motion.div
                    key={user.userId}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => handleUserClick(user)}
                    className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-accent transition-colors"
                  >
                    <div className="relative">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user.avatarUrl || avatarPlaceholder} alt={user.firstName} />
                        <AvatarFallback>
                          {user.firstName?.[0]}{user.lastName?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      {user.isOnline && (
                        <span className="absolute bottom-0 right-0 h-3 w-3 bg-green-500 border-2 border-background rounded-full" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {user.firstName} {user.lastName}
                      </p>
                      {user.bio && (
                        <p className="text-sm text-muted-foreground truncate">
                          {user.bio}
                        </p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : hasSearched && !isSearching ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-8 text-muted-foreground"
              >
                <Search className="h-12 w-12 mb-2 opacity-50" />
                <p>No users found</p>
                <p className="text-sm">Try a different search term</p>
              </motion.div>
            ) : !hasSearched ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-8 text-muted-foreground"
              >
                <UserPlus className="h-12 w-12 mb-2 opacity-50" />
                <p>Search for users</p>
                <p className="text-sm">Start typing to find people</p>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export default AddContactModal;
