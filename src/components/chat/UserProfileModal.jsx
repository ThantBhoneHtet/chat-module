import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { MessageSquare, MapPin, X, Phone, Mail, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import avatarPlaceholder from "../../assets/avatar.jpg";
import { usersAPI } from '../../rest-api/services/users';
import { chatAPI } from '../../rest-api/services/messages';
import { toast } from 'sonner';

export function UserProfileModal({ 
  isOpen, 
  onClose, 
  user, 
  loading = false,
  currentUserId,
  onNavigateToChat 
}) {
  const handleMessageClick = async () => {
    if (!user) return;
    
    const targetUserId = user.userId || user.id;
    
    try {
      // Check if chat already exists
      const existingChatId = await chatAPI.checkChatExists([currentUserId, targetUserId]);
      
      if (existingChatId) {
        if (onNavigateToChat) {
          onNavigateToChat(existingChatId, null);
        }
        toast.success('Opening existing chat');
      } else {
        // Create temporary chat data for navigation
        const tempChat = {
          chatId: `temp-${currentUserId}-${targetUserId}`,
          type: 'DIRECT',
          participants: [currentUserId, targetUserId],
          isTemporary: true,
          otherParticipant: {
            id: targetUserId,
            firstName: user.firstName,
            lastName: user.lastName,
            avatarUrl: user.avatarUrl,
            isOnline: user.isOnline
          }
        };
        
        if (onNavigateToChat) {
          onNavigateToChat(null, tempChat);
        }
      }
    } catch (error) {
      console.error('Failed to start conversation:', error);
      toast.error('Failed to start conversation');
    }
    
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-card rounded-2xl shadow-2xl border max-w-sm w-full mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {loading ? (
              <div className="p-8 flex flex-col items-center justify-center">
                <div className="h-16 w-16 rounded-full bg-muted animate-pulse mb-4" />
                <div className="h-4 w-32 bg-muted animate-pulse rounded mb-2" />
                <div className="h-3 w-24 bg-muted animate-pulse rounded" />
              </div>
            ) : user && (
              <>
                {/* Header with close button */}
                <div className="relative bg-gradient-to-br from-primary/20 to-primary/5 p-6 pb-12">
                  <button
                    onClick={onClose}
                    className="absolute top-3 right-3 p-1.5 rounded-full bg-background/80 hover:bg-background transition-colors"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
                
                {/* Avatar overlapping header */}
                <div className="relative px-6 -mt-10">
                  <div className="relative inline-block">
                    <Avatar className="h-20 w-20 border-4 border-card">
                      <AvatarImage src={user.avatarUrl || avatarPlaceholder} />
                      <AvatarFallback className="text-xl bg-primary/20 text-primary">
                        {user.firstName?.charAt(0)}{user.lastName?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    {user.isOnline && (
                      <div className="absolute bottom-1 right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-card" />
                    )}
                  </div>
                </div>
                
                {/* User info */}
                <div className="px-6 pt-3 pb-6 space-y-3">
                  <h3 className="text-xl font-semibold text-foreground">
                    {user.firstName} {user.lastName}
                  </h3>
                  
                  {/* Gender */}
                  {user.gender && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="h-4 w-4" />
                      <span className="capitalize">{user.gender}</span>
                    </div>
                  )}
                  
                  {/* Email */}
                  {user.email && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      <span>{user.email}</span>
                    </div>
                  )}
                  
                  {/* Phone */}
                  {user.phoneNumber && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      <span>{user.phoneNumber}</span>
                    </div>
                  )}
                  
                  {/* Location */}
                  {user.location && (user.location.city || user.location.country) && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span>
                        {[user.location.city, user.location.country].filter(Boolean).join(', ')}
                      </span>
                    </div>
                  )}
                  
                  {/* Bio */}
                  {user.bio && (
                    <p className="text-sm text-muted-foreground pt-2 border-t border-border">
                      {user.bio}
                    </p>
                  )}
                  
                  {/* Message button */}
                  <Button
                    onClick={handleMessageClick}
                    className="w-full mt-4 gap-2"
                  >
                    <MessageSquare className="h-4 w-4" />
                    Message
                  </Button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Hook to manage user profile modal state
export function useUserProfileModal() {
  const [modalState, setModalState] = useState({ show: false, user: null, loading: false });

  const openProfile = async (userId, currentUserId) => {
    if (!userId || userId === currentUserId) return;
    
    setModalState({ show: true, user: null, loading: true });
    
    try {
      const userProfile = await usersAPI.getProfile(userId);
      setModalState({ show: true, user: userProfile, loading: false });
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      toast.error('Failed to load user profile');
      setModalState({ show: false, user: null, loading: false });
    }
  };

  const closeProfile = () => {
    setModalState({ show: false, user: null, loading: false });
  };

  return {
    isOpen: modalState.show,
    user: modalState.user,
    loading: modalState.loading,
    openProfile,
    closeProfile
  };
}
