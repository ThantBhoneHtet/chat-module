import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader } from './ui/card';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { Separator } from './ui/separator';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from './ui/carousel';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';

import { 
  ArrowLeft, 
  Star, 
  Clock, 
  Users, 
  MapPin, 
  Calendar, 
  Phone, 
  Mail,
  Award,
  TrendingUp,
  MessageSquare
} from 'lucide-react';
import { usersAPI, chatAPI } from '../../rest-api';
import { useAuth } from '@/shared/context/AuthContext';
import { toast } from 'sonner';

// Function to convert Firestore Timestamp to JavaScript Date, as used in your dashboard
const convertFirestoreTimestamp = (timestamp) => {
  if (!timestamp || !timestamp.seconds) {
    return null;
  }
  return new Date(timestamp.seconds * 1000);
};

const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";
    const date = new Date(timestamp.seconds * 1000);
    return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  };

const UserProfile = () => {
  const { id: userId } = useParams();
  const navigate = useNavigate();
  const { authUser } = useAuth();
  
  const [user, setUser] = useState(null);
  const [feedbacks, setFeedbacks] = useState([]);
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [totalHours, setTotalHours] = useState(0);
  const [completedOpportunities, setCompletedOpportunities] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true);
        
        // Fetch user profile
        const userData = await usersAPI.getProfile(userId);
        setUser(userData);

        // Fetch completed opportunities
       const completedResponse = await axios.get(
          `https://spring-boot-chat-backend-production.up.railway.app/api/opportunities/completed/user/${userId}`
        );
        const completedOpps = completedResponse.data;


        // Calculate total hours using the same logic as the user dashboard
        const totalHoursCalculated = completedOpps.reduce((sum, opportunity) => {
          let hoursPerWeek = 0;
          const start = convertFirestoreTimestamp(opportunity.startDate);
          const end = convertFirestoreTimestamp(opportunity.endDate);

          if (opportunity.timeCommitment && typeof opportunity.timeCommitment === 'string') {
            const match = opportunity.timeCommitment.match(/(\d+)\s*hours?/i);
            hoursPerWeek = match ? parseInt(match[1], 10) : 0;
          }

          if (start && end && !isNaN(start.getTime()) && !isNaN(end.getTime()) && hoursPerWeek > 0) {
            const diffMs = end - start;
            const diffDays = diffMs / (1000 * 60 * 60 * 24);
            const weeks = Math.floor(diffDays / 7);
            const now = new Date();

            if (end <= now && weeks > 0) {
              return sum + hoursPerWeek * weeks;
            }
          }
          return sum;
        }, 0);

        setTotalHours(totalHoursCalculated);
        setCompletedOpportunities(completedOpps.length);

        // Fetch feedbacks
        const feedbackData = await usersAPI.getFeedbacks(userId);
        const feedbacks = feedbackData?.feedbackDetails ?? [];
        if (feedbacks.length > 0) {
          setFeedbacks(feedbacks);
        }

      } catch (err) {
        setError('Failed to load user profile');
        console.error('Error fetching user data:', err.response ? err.response.data : err.message);
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchUserData();
    }
  }, [userId]);

  const handleMessageClick = async () => {
    // Check if user is logged in
    const currentUserData = sessionStorage.getItem('currentUser');
    if (!currentUserData) {
      setShowLoginDialog(true);
      return;
    }

    try {
      const currentUserId = authUser?.userId || authUser?.id;
      const targetUserId = user.userId || user.id;

      if (currentUserId === targetUserId) return;
      
      if (!currentUserId || !targetUserId) {
        toast.error('Unable to start conversation. User information missing.');
        return;
      }

      // Check if chat already exists
      const existingChatId = await chatAPI.checkChatExists([currentUserId, targetUserId]);
      
      if (existingChatId) {
        // Chat exists, navigate to messages with existing chat
        const chat = await chatAPI.getChatById(existingChatId);
        // Navigate to dashboard with proper parameters to open Messages section with selected chat
        navigate('/user/dashboard?section=messages', { 
          state: { 
            activeSection: 'messages', 
            selectedChatFromColleagues: chat 
          } 
        });
      } else {
        // Create new direct chat
        const chatRequest = {
          type: 'DIRECT',
          name: null,
          participantIds: [currentUserId, targetUserId]
        };
        
        const newChat = await chatAPI.createChat(chatRequest);
        // Navigate to dashboard with proper parameters to open Messages section with selected chat
        navigate('/user/dashboard?section=messages', { 
          state: { 
            activeSection: 'messages', 
            selectedChatFromColleagues: newChat 
          } 
        });
      }
    } catch (error) {
      console.error('Error handling message click:', error);
      toast.error('Failed to start conversation. Please try again.');
    }
  };

  const handleLoginRedirect = () => {
    setShowLoginDialog(false);
    navigate('/login');
  };

  const ProfileSkeleton = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-6">
          <div className="flex flex-col md:flex-row gap-6">
            <Skeleton className="h-32 w-32 rounded-full mx-auto md:mx-0" />
            <div className="flex-1 space-y-4">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-48" />
              <div className="flex gap-4">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-6 w-28" />
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <main className="pt-20 pb-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <ProfileSkeleton />
          </div>
        </main>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="min-h-screen bg-background">
        <main className="pt-20 pb-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center py-16">
              <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-4">user Not Found</h2>
              <p className="text-muted-foreground mb-8">{error || 'The requested user profile could not be found.'}</p>
              <Button onClick={() => navigate('/users')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to All Users
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="pt-20 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Back Button */}
          <Button 
            variant="ghost" 
            onClick={() => navigate('/users')}
            className="mb-6 flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to All Users
          </Button>

          {/* Profile Header */}
          <Card className="mb-8">
            <CardHeader className="pb-6">
              <div className="flex flex-col md:flex-row gap-6">
                {/* Avatar */}
                <div className="flex justify-center md:justify-start">
                  <Avatar className="h-32 w-32 border-4 border-primary/20">
                    <AvatarImage 
                      src={user.avatarUrl} 
                      alt={`${user.firstName} ${user.lastName}`} 
                    />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold text-3xl">
                      {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                </div>

                {/* Basic Info */}
                <div className="flex-1 text-center md:text-left">
                  <h1 className="text-3xl font-bold mb-2">
                    {user.firstName} {user.lastName}
                  </h1>
                  
                  {user.location && (
                    <div className="flex items-center justify-center md:justify-start gap-2 text-muted-foreground mb-4">
                      <MapPin className="h-4 w-4" />
                      <span>{user.location.city}, {user.location.state}</span>
                    </div>
                  )}

                  <div className="flex flex-wrap justify-center md:justify-start gap-4 mb-4">
                    <div className="flex items-center gap-2 bg-primary/10 px-3 py-1 rounded-full">
                      <Star className="h-4 w-4 text-primary fill-primary" />
                      <span className="font-semibold text-primary">
                        {(user.rating || 0).toFixed(1)} Rating
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 bg-secondary/50 px-3 py-1 rounded-full">
                      <Clock className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        {totalHours.toFixed(1)} Hours
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 bg-secondary/50 px-3 py-1 rounded-full">
                      <Users className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        {completedOpportunities} Projects
                      </span>
                    </div>
                  </div>

                {/* Contact Info & Message Button */}
                 <div className="flex flex-wrap justify-center md:justify-start gap-4 text-sm text-muted-foreground mb-4">
                   {user.email && (
                     <div className="flex items-center gap-1">
                       <Mail className="h-3 w-3" />
                       <span>{user.email}</span>
                     </div>
                   )}
                   {user.phoneNumber && (
                     <div className="flex items-center gap-1">
                       <Phone className="h-3 w-3" />
                       <span>{user.phoneNumber}</span>
                     </div>
                   )}
                   {user.joinDate && (
                     <div className="flex items-center gap-1">
                       <Calendar className="h-3 w-3" />
                       <span>Joined {new Date(user.joinDate).toLocaleDateString()}</span>
                     </div>
                   )}
                 </div>

                 {/* Animated Message Button */}
                 <button 
                   onClick={handleMessageClick}
                   className="group relative inline-flex items-center justify-center w-12 h-12 overflow-hidden transition-all duration-300 bg-gradient-to-br from-primary via-primary/90 to-primary/80 hover:from-primary/90 hover:via-primary/70 hover:to-primary/60 rounded-full shadow-lg hover:shadow-xl hover:shadow-primary/25 border-2 border-primary/20 hover:border-primary/30 hover:w-40 focus:outline-none focus:ring-2 focus:ring-primary/50 active:scale-95"
                 >
                   <div className="flex items-center justify-center w-full transition-all duration-300 group-hover:w-1/3">
                     <MessageSquare className="w-5 h-5 text-white" />
                   </div>
                   
                   <div className="absolute right-0 pr-3 opacity-0 text-white font-medium text-sm transition-all duration-300 group-hover:opacity-100 group-hover:w-2/3 overflow-hidden whitespace-nowrap">
                     Send Message
                   </div>
                 </button>
                </div>
              </div>

              {/* Bio */}
              {user.bio && (
                <>
                  <Separator className="my-6" />
                  <div>
                    <h3 className="font-semibold mb-2">About</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      {user.bio}
                    </p>
                  </div>
                </>
              )}

              {/* Skills */}
              {user.skills && user.skills.length > 0 && (
                <>
                  <Separator className="my-6" />
                  <div>
                    <h3 className="font-semibold mb-3">Skills & Expertise</h3>
                    <div className="flex flex-wrap gap-2">
                      {user.skills.map((skill, index) => (
                        <Badge key={index} variant="secondary" className="px-3 py-1">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardHeader>
          </Card>

          {/* Stats and Feedback Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Performance Stats */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Performance Stats</h3>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Average Rating</span>
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 text-primary fill-primary" />
                    <span className="font-semibold">{(user.rating || 0).toFixed(1)}/5.0</span>
                  </div>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Hours Usered</span>
                  <span className="font-semibold">{totalHours.toFixed(1)}h</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Projects Completed</span>
                  <span className="font-semibold">{completedOpportunities}</span>
                </div>
                
                
              </CardContent>
            </Card>

            {/* Recent Feedback Carousel */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Recent Feedback</h3>
                  {feedbacks.length > 0 && (
                    <Badge variant="secondary" className="ml-auto">
                      {feedbacks.length}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {feedbacks.length > 0 ? (
                  <Carousel className="w-full">
                    <CarouselContent>
                      {feedbacks.slice(0, 3).map((feedback, index) => (
                        <CarouselItem key={index}>
                          <div className="relative bg-gradient-to-br from-yellow-50/80 via-amber-50/60 to-orange-50/50 border border-yellow-200/60 rounded-xl p-5 shadow-md hover:shadow-xl transition-all duration-300 backdrop-blur-sm">
                            {/* Animated background sparkles */}
                            <div className="absolute inset-0 overflow-hidden rounded-xl">
                              <div className="absolute top-3 right-6 w-1 h-1 bg-yellow-400 rounded-full animate-ping opacity-60"></div>
                              <div className="absolute bottom-6 left-8 w-1 h-1 bg-amber-400 rounded-full animate-ping delay-1000 opacity-40"></div>
                              <div className="absolute top-1/2 left-1/3 w-0.5 h-0.5 bg-yellow-300 rounded-full animate-pulse delay-500"></div>
                            </div>
                            
                            <div className="relative z-10">
                              <div className="flex justify-between items-start gap-3 mb-4">
                                <div className="flex items-center gap-2 bg-gradient-to-r from-yellow-100/80 to-amber-100/70 px-3 py-2 rounded-full shadow-sm border border-yellow-200/50">
                                  <div className="relative">
                                    <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 animate-pulse" />
                                    <div className="absolute inset-0 animate-ping">
                                      <Star className="h-4 w-4 text-yellow-400 fill-yellow-400/30" />
                                    </div>
                                  </div>
                                  <span className="text-sm font-bold bg-gradient-to-r from-yellow-700 to-amber-700 bg-clip-text text-transparent">
                                    {feedback.score}/5
                                  </span>
                                </div>
                                
                                <div className="flex items-center gap-3 bg-white/70 backdrop-blur-sm px-3 py-2 rounded-full border border-orange-200/50 shadow-sm">
                                  <Avatar className="h-8 w-8 ring-2 ring-yellow-200 shadow-md">
                                    <AvatarImage src={feedback.logoUrl} alt={feedback.organizationName} />
                                    <AvatarFallback className="text-xs bg-gradient-to-br from-orange-100 to-yellow-100 text-orange-600 font-bold shadow-inner">
                                      {feedback.organizationName?.charAt(0) || 'O'}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-xs font-semibold text-orange-700">
                                    {feedback.organizationName}
                                  </span>
                                </div>
                              </div>
                              
                              <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 border border-yellow-200/60 shadow-inner">
                                <h4 className="font-semibold text-gray-800 mb-3 text-sm flex items-center gap-2">
                                  <Award className="h-4 w-4 text-yellow-600" />
                                  {feedback.opportunityName}
                                </h4>
                                
                                <p className="text-xs text-gray-500 mb-3 flex items-center gap-2 bg-gray-50/80 px-2 py-1 rounded-md">
                                  <Calendar className="h-3 w-3 text-gray-400" />
                                  {formatDate(feedback.feedbackTime) || '12-08-2025'}
                                </p>
                                
                                <div className="relative">
                                  <div className="absolute -left-1 -top-1 text-yellow-400/30 text-2xl font-serif">"</div>
                                  <p className="text-sm text-gray-700 leading-relaxed pl-4 italic">
                                    {feedback.feedbackText || 'Great work and dedication!'}
                                  </p>
                                  <div className="absolute -right-1 -bottom-1 text-yellow-400/30 text-2xl font-serif rotate-180">"</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                    {feedbacks.length > 1 && (
                      <>
                        <CarouselPrevious className="left-2 bg-white/80 border-yellow-200 hover:bg-yellow-50" />
                        <CarouselNext className="right-2 bg-white/80 border-yellow-200 hover:bg-yellow-50" />
                      </>
                    )}
                  </Carousel>
                ) : (
                  <div className="text-center py-12 bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-xl border border-gray-200/50">
                    <div className="relative inline-block mb-4">
                      <Award className="h-12 w-12 text-gray-400 mx-auto" />
                      <div className="absolute inset-0 animate-pulse">
                        <Award className="h-12 w-12 text-gray-300/50 mx-auto" />
                      </div>
                    </div>
                    <p className="text-sm text-gray-500 font-medium">
                      No feedback available yet
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Feedback will appear here after completing projects
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

        </div>
      </main>

      {/* Login Required Dialog */}
      <AlertDialog open={showLoginDialog} onOpenChange={setShowLoginDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Login Required</AlertDialogTitle>
            <AlertDialogDescription>
              You need to be logged in to send messages. Would you like to go to the login page?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setShowLoginDialog(false)}>
              Cancel
            </Button>
            <AlertDialogAction onClick={handleLoginRedirect}>
              Go to Login
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UserProfile;