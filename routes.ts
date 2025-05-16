import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { DatabaseStorage } from "./storage_db";
import { pool } from "./db";

// Initialize DatabaseStorage
const storage = new DatabaseStorage();
import { 
  insertPlaybackHistorySchema, 
  insertFavoriteSchema, 
  insertLiveStreamSchema, 
  insertUserSchema,
  insertSongRequestSchema,
  insertChatMessageSchema,
  insertNotificationSchema,
  insertNotificationPreferencesSchema
} from "@shared/schema";
import { z } from "zod";
import { setupAuth } from "./auth";
import { WebSocketServer } from "ws";

// Middleware to check if user is authenticated
const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};

// Middleware to check if user is a DJ
const isDj = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated() && req.user.role === "dj") {
    // Check if DJ is approved
    if (req.user.isApproved !== false) {
      return next();
    }
    res.status(403).json({ message: "Your DJ account is pending approval" });
  } else {
    res.status(403).json({ message: "Forbidden - DJ access required" });
  }
};

// Middleware to check if user is an admin
const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated() && req.user.role === "admin") {
    return next();
  }
  res.status(403).json({ message: "Forbidden - Admin access required" });
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication
  setupAuth(app);
  // Get all categories
  app.get("/api/categories", async (req: Request, res: Response) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ message: "Error fetching categories" });
    }
  });

  // Get category by ID
  app.get("/api/categories/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const category = await storage.getCategoryById(id);
      
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      
      res.json(category);
    } catch (error) {
      res.status(500).json({ message: "Error fetching category" });
    }
  });

  // VJMZ-FM exclusive station data
  const vjmzStation = {
    id: 9999,
    name: "VJMZ-FM",
    description: "Internet's #1 JAM'N STATION",
    // Free test stream until you set up your own streaming service
    streamUrl: "https://ice1.somafm.com/defcon-128-mp3", // SomaFM MP3 stream (widely compatible)
    imageUrl: "/vjmz-banner.jpg",
    logoUrl: "/vjmz-logo.jpg",
    isLive: true,
    categoryId: 1,
    tags: "hiphop,rnb,top40",
    listenerCount: 4850,
    isFeatured: true,
    isTrending: true
  };

  // Get all stations - return only VJMZ-FM
  app.get("/api/stations", async (req: Request, res: Response) => {
    try {
      res.json([vjmzStation]);
    } catch (error) {
      res.status(500).json({ message: "Error fetching stations" });
    }
  });
  
  // Get featured stations - return only VJMZ-FM
  app.get("/api/stations/featured", async (req: Request, res: Response) => {
    try {
      res.json([vjmzStation]);
    } catch (error) {
      res.status(500).json({ message: "Error fetching featured stations" });
    }
  });
  
  // Get trending stations - return only VJMZ-FM
  app.get("/api/stations/trending", async (req: Request, res: Response) => {
    try {
      res.json([vjmzStation]);
    } catch (error) {
      res.status(500).json({ message: "Error fetching trending stations" });
    }
  });

  // Get station by ID - always return VJMZ-FM regardless of ID
  app.get("/api/stations/:id", async (req: Request, res: Response) => {
    try {
      // Always return VJMZ-FM as the station, regardless of ID
      res.json(vjmzStation);
    } catch (error) {
      res.status(500).json({ message: "Error fetching station" });
    }
  });

  // Get stations by category - always return VJMZ-FM
  app.get("/api/categories/:id/stations", async (req: Request, res: Response) => {
    try {
      // Always return VJMZ-FM as the only station, regardless of category
      res.json([vjmzStation]);
    } catch (error) {
      res.status(500).json({ message: "Error fetching stations by category" });
    }
  });

  // Get now playing for VJMZ-FM - always return VJMZ-FM content
  app.get("/api/stations/:id/now-playing", async (req: Request, res: Response) => {
    try {
      // Create a static now playing response for VJMZ-FM
      const vjmzNowPlaying = {
        id: 1,
        stationId: 9999,
        title: "VJMZ-FM Exclusive Mix",
        artist: "DJ Smooth",
        album: "Internet's #1 JAM'N STATION",
        coverArt: "/vjmz-logo.jpg",
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 3600000).toISOString() // One hour from now
      };
      
      res.json(vjmzNowPlaying);
    } catch (error) {
      res.status(500).json({ message: "Error fetching now playing information" });
    }
  });

  // Get playback history - only VJMZ-FM content
  app.get("/api/history", async (req: Request, res: Response) => {
    try {
      // Create static VJMZ-FM history entries
      const vjmzHistory = [
        {
          id: 1,
          userId: 1,
          stationId: 9999,
          timestamp: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
          duration: 300, // 5 minutes
          station: vjmzStation
        },
        {
          id: 2,
          userId: 1,
          stationId: 9999,
          timestamp: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
          duration: 420, // 7 minutes
          station: vjmzStation
        },
        {
          id: 3,
          userId: 1,
          stationId: 9999,
          timestamp: new Date(Date.now() - 10800000).toISOString(), // 3 hours ago
          duration: 540, // 9 minutes
          station: vjmzStation
        }
      ];
      
      res.json(vjmzHistory);
    } catch (error) {
      res.status(500).json({ message: "Error fetching playback history" });
    }
  });

  // Create playback history
  app.post("/api/history", async (req: Request, res: Response) => {
    try {
      const validatedData = insertPlaybackHistorySchema.parse(req.body);
      const history = await storage.createPlaybackHistory(validatedData);
      res.status(201).json(history);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      res.status(500).json({ message: "Error creating playback history" });
    }
  });

  // Get favorites - always return VJMZ-FM as a favorite
  app.get("/api/favorites", async (req: Request, res: Response) => {
    try {
      // Always return VJMZ-FM as a favorite
      const vjmzFavorite = {
        id: 1, 
        userId: req.user?.id || 1,
        stationId: 9999,
        createdAt: new Date().toISOString(),
        station: vjmzStation
      };
      
      res.json([vjmzFavorite]);
    } catch (error) {
      res.status(500).json({ message: "Error fetching favorites" });
    }
  });

  // Add to favorites - always accept VJMZ-FM favoriting
  app.post("/api/favorites", async (req: Request, res: Response) => {
    try {
      // Create a VJMZ-FM favorite regardless of input
      const vjmzFavorite = {
        id: 1,
        userId: req.user?.id || req.body.userId || 1,
        stationId: 9999,
        createdAt: new Date().toISOString()
      };
      
      res.status(201).json(vjmzFavorite);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      res.status(500).json({ message: "Error adding to favorites" });
    }
  });

  // Remove from favorites - respond with success but don't actually remove
  app.delete("/api/favorites/:stationId", async (req: Request, res: Response) => {
    try {
      // Always return success (we'll re-add it on the next check)
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Error removing from favorites" });
    }
  });

  // Check if station is in favorites - always return true for VJMZ-FM
  app.get("/api/favorites/check/:stationId", async (req: Request, res: Response) => {
    try {
      // Always say VJMZ-FM is a favorite
      res.json({ isFavorite: true });
    } catch (error) {
      res.status(500).json({ message: "Error checking favorite status" });
    }
  });

  // === DJ Live Stream Management API ===
  
  // Get all live streams
  app.get("/api/live-streams", async (req: Request, res: Response) => {
    try {
      const liveStreams = await storage.getLiveStreams();
      res.json(liveStreams);
    } catch (error) {
      res.status(500).json({ message: "Error fetching live streams" });
    }
  });
  
  // Get a specific live stream
  app.get("/api/live-streams/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const liveStream = await storage.getLiveStreamById(id);
      
      if (!liveStream) {
        return res.status(404).json({ message: "Live stream not found" });
      }
      
      res.json(liveStream);
    } catch (error) {
      res.status(500).json({ message: "Error fetching live stream" });
    }
  });
  
  // Get all live streams by a specific DJ
  app.get("/api/djs/:djId/live-streams", async (req: Request, res: Response) => {
    try {
      const djId = parseInt(req.params.djId);
      const liveStreams = await storage.getLiveStreamsByDj(djId);
      res.json(liveStreams);
    } catch (error) {
      res.status(500).json({ message: "Error fetching DJ live streams" });
    }
  });
  
  // Get all DJs
  app.get("/api/djs", async (req: Request, res: Response) => {
    try {
      const djs = await storage.getUsersByRole("dj");
      res.json(djs);
    } catch (error) {
      res.status(500).json({ message: "Error fetching DJs" });
    }
  });
  
  // Create a new live stream (DJ only)
  app.post("/api/live-streams", isDj, async (req: Request, res: Response) => {
    try {
      const validatedData = insertLiveStreamSchema.parse(req.body);
      const djId = req.user!.id; // We know user exists because of isDj middleware
      
      const liveStream = await storage.createLiveStream({
        ...validatedData,
        djId
      });
      
      res.status(201).json(liveStream);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      res.status(500).json({ message: "Error creating live stream" });
    }
  });
  
  // Update a live stream (DJ only)
  app.patch("/api/live-streams/:id", isDj, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const liveStream = await storage.getLiveStreamById(id);
      
      if (!liveStream) {
        return res.status(404).json({ message: "Live stream not found" });
      }
      
      // Check if the DJ owns this stream
      if (liveStream.djId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to update this stream" });
      }
      
      const updatedStream = await storage.updateLiveStream(id, req.body);
      res.json(updatedStream);
    } catch (error) {
      res.status(500).json({ message: "Error updating live stream" });
    }
  });
  
  // Start a live stream (DJ only)
  app.post("/api/live-streams/:id/start", isDj, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const liveStream = await storage.getLiveStreamById(id);
      
      if (!liveStream) {
        return res.status(404).json({ message: "Live stream not found" });
      }
      
      // Check if the DJ owns this stream
      if (liveStream.djId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to start this stream" });
      }
      
      const startedStream = await storage.startLiveStream(id);
      res.json(startedStream);
    } catch (error) {
      res.status(500).json({ message: "Error starting live stream" });
    }
  });
  
  // End a live stream (DJ only)
  app.post("/api/live-streams/:id/end", isDj, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const liveStream = await storage.getLiveStreamById(id);
      
      if (!liveStream) {
        return res.status(404).json({ message: "Live stream not found" });
      }
      
      // Check if the DJ owns this stream
      if (liveStream.djId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to end this stream" });
      }
      
      const endedStream = await storage.endLiveStream(id);
      res.json(endedStream);
    } catch (error) {
      res.status(500).json({ message: "Error ending live stream" });
    }
  });
  
  // Delete a live stream (DJ only)
  app.delete("/api/live-streams/:id", isDj, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const liveStream = await storage.getLiveStreamById(id);
      
      if (!liveStream) {
        return res.status(404).json({ message: "Live stream not found" });
      }
      
      // Check if the DJ owns this stream
      if (liveStream.djId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to delete this stream" });
      }
      
      await storage.deleteLiveStream(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Error deleting live stream" });
    }
  });

  // === User Profile Management API ===
  
  // Get a user by ID
  app.get("/api/users/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const user = await storage.getUser(id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Remove sensitive information
      const { password, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      res.status(500).json({ message: "Error fetching user" });
    }
  });
  
  // Update user profile (authenticated users only)
  app.patch("/api/users/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      // Users can only update their own profile
      if (id !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to update this profile" });
      }
      
      // Only allow specific fields to be updated
      const allowedFields = ["displayName", "bio", "profileImage"];
      const updateData = Object.keys(req.body)
        .filter(key => allowedFields.includes(key))
        .reduce((obj, key) => {
          obj[key] = req.body[key];
          return obj;
        }, {} as any);
      
      const updatedUser = await storage.updateUser(id, updateData);
      
      // Remove sensitive information
      const { password, ...safeUser } = updatedUser;
      res.json(safeUser);
    } catch (error) {
      res.status(500).json({ message: "Error updating user profile" });
    }
  });
  
  // Song Request Routes
  // Get song requests (for the authenticated user or all if DJ)
  app.get("/api/song-requests", isAuthenticated, async (req: Request, res: Response) => {
    try {
      // If user is a DJ, they can see all requests or filter by status
      if (req.user!.role === "dj") {
        const status = req.query.status as string | undefined;
        const requests = await storage.getSongRequests(undefined, status);
        return res.json(requests);
      }
      
      // Regular users can only see their own requests
      const requests = await storage.getSongRequests(req.user!.id);
      res.json(requests);
    } catch (error) {
      console.error("Error fetching song requests:", error);
      res.status(500).json({ message: "Error fetching song requests" });
    }
  });
  
  // Get song request by ID
  app.get("/api/song-requests/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const request = await storage.getSongRequestById(id);
      
      if (!request) {
        return res.status(404).json({ message: "Song request not found" });
      }
      
      // Only the requesting user or DJs can view the request
      if (request.userId !== req.user!.id && req.user!.role !== "dj") {
        return res.status(403).json({ message: "Not authorized to view this request" });
      }
      
      res.json(request);
    } catch (error) {
      console.error("Error fetching song request:", error);
      res.status(500).json({ message: "Error fetching song request" });
    }
  });
  
  // Create a new song request
  app.post("/api/song-requests", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const validatedData = insertSongRequestSchema.parse(req.body);
      const songRequest = await storage.createSongRequest({
        ...validatedData,
        userId: req.user!.id,
        status: "pending" // Default status
      });
      
      res.status(201).json(songRequest);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      console.error("Error creating song request:", error);
      res.status(500).json({ message: "Error creating song request" });
    }
  });
  
  // Update song request status (DJ only)
  app.patch("/api/song-requests/:id/status", isDj, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { status, response } = req.body;
      
      if (!["pending", "approved", "denied", "played"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      
      const updatedRequest = await storage.updateSongRequestStatus(id, status, response);
      
      res.json(updatedRequest);
    } catch (error) {
      console.error("Error updating song request status:", error);
      res.status(500).json({ message: "Error updating song request status" });
    }
  });
  
  // Chat Messages for AI Dedications
  app.get("/api/chat/messages", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const messages = await storage.getChatMessages(req.user!.id);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching chat messages:", error);
      res.status(500).json({ message: "Error fetching chat messages" });
    }
  });
  
  app.post("/api/chat/messages", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { content, type } = req.body;
      
      if (!content || !type) {
        return res.status(400).json({ message: "Content and type are required" });
      }
      
      const message = await storage.createChatMessage({
        userId: req.user!.id,
        content,
        type,
        timestamp: new Date()
      });
      
      // If this is a user message, we would process it with AI here
      // and then create a response message automatically
      if (type === "user") {
        // In a production app, we would call an AI API here
        // For now, we'll create a simple "received" response
        await storage.createChatMessage({
          userId: req.user!.id,
          content: "Thank you for your dedication request! Our DJs will review it shortly.",
          type: "system",
          timestamp: new Date()
        });
      }
      
      res.status(201).json(message);
    } catch (error) {
      console.error("Error sending chat message:", error);
      res.status(500).json({ message: "Error sending chat message" });
    }
  });
  
  // Notification Preferences
  app.get("/api/notifications/preferences", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const preferences = await storage.getNotificationPreferences(req.user!.id);
      
      // If no preferences exist, return defaults
      if (!preferences) {
        return res.json({
          userId: req.user!.id,
          emailEnabled: true,
          pushEnabled: true,
          contestAlerts: true,
          newShowAlerts: true,
          specialEventsAlerts: true
        });
      }
      
      res.json(preferences);
    } catch (error) {
      console.error("Error fetching notification preferences:", error);
      res.status(500).json({ message: "Error fetching notification preferences" });
    }
  });
  
  app.post("/api/notifications/preferences", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const validatedData = insertNotificationPreferencesSchema
        .omit({ userId: true })
        .parse(req.body);
      
      const preferences = await storage.createOrUpdateNotificationPreferences(
        req.user!.id,
        {
          ...validatedData,
          userId: req.user!.id
        }
      );
      
      res.json(preferences);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid preferences data", errors: error.errors });
      }
      console.error("Error updating notification preferences:", error);
      res.status(500).json({ message: "Error updating notification preferences" });
    }
  });
  
  // User Notifications
  app.get("/api/notifications", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const unreadOnly = req.query.unreadOnly === 'true';
      const notifications = await storage.getNotifications(req.user!.id, unreadOnly);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Error fetching notifications" });
    }
  });
  
  app.post("/api/notifications/read/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const notification = await storage.markNotificationAsRead(id);
      res.json(notification);
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Error marking notification as read" });
    }
  });
  
  app.post("/api/notifications/read-all", isAuthenticated, async (req: Request, res: Response) => {
    try {
      await storage.markAllNotificationsAsRead(req.user!.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ message: "Error marking all notifications as read" });
    }
  });
  
  // ===== ADMIN API ROUTES =====
  
  // Get all DJs (admin only)
  app.get("/api/admin/djs", isAdmin, async (req: Request, res: Response) => {
    try {
      const djs = await storage.getUsersByRole("dj");
      res.json(djs);
    } catch (error) {
      console.error("Error fetching DJs:", error);
      res.status(500).json({ message: "Error fetching DJs" });
    }
  });
  
  // Update DJ status (admin only)
  app.patch("/api/admin/djs/:id/status", isAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { accountStatus, isApproved, isActive } = req.body;
      
      // Validate data
      if (!["active", "locked", "deactivated"].includes(accountStatus)) {
        return res.status(400).json({ message: "Invalid account status" });
      }
      
      const updatedUser = await storage.updateUser(id, {
        accountStatus,
        isApproved,
        isActive
      });
      
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating DJ status:", error);
      res.status(500).json({ message: "Error updating DJ status" });
    }
  });
  
  // Approve DJ and assign employee ID (admin only)
  app.patch("/api/admin/djs/:id/approve", isAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { approved } = req.body;
      
      // Get the user to check if it's a DJ and existing state
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      if (user.role !== "dj") {
        return res.status(400).json({ message: "User is not a DJ" });
      }
      
      // Generate a random employee ID if the DJ is being approved
      let employeeId = user.employeeId;
      if (approved && (!employeeId || employeeId === null)) {
        // Generate a random 6-8 digit alphanumeric ID
        const characters = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        const length = Math.floor(Math.random() * 3) + 6; // 6-8 characters
        employeeId = Array.from({ length }, () => 
          characters.charAt(Math.floor(Math.random() * characters.length))
        ).join("");
      }
      
      const updatedUser = await storage.updateUser(id, {
        isApproved: approved,
        employeeId: approved ? employeeId : null,
        accountStatus: approved ? "active" : "inactive"
      });
      
      res.json(updatedUser);
    } catch (error) {
      console.error("Error approving DJ:", error);
      res.status(500).json({ message: "Error approving DJ" });
    }
  });
  
  // Get all time slots (admin only)
  app.get("/api/admin/time-slots", isAdmin, async (req: Request, res: Response) => {
    try {
      const timeSlots = await storage.getDjTimeSlots();
      res.json(timeSlots);
    } catch (error) {
      console.error("Error fetching time slots:", error);
      res.status(500).json({ message: "Error fetching time slots" });
    }
  });
  
  // Create a new time slot (admin only)
  app.post("/api/admin/time-slots", isAdmin, async (req: Request, res: Response) => {
    try {
      const timeSlot = await storage.createDjTimeSlot(req.body);
      res.status(201).json(timeSlot);
    } catch (error) {
      console.error("Error creating time slot:", error);
      res.status(500).json({ message: "Error creating time slot" });
    }
  });
  
  // Update a time slot (admin only)
  app.patch("/api/admin/time-slots/:id", isAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const timeSlot = await storage.updateDjTimeSlot(id, req.body);
      res.json(timeSlot);
    } catch (error) {
      console.error("Error updating time slot:", error);
      res.status(500).json({ message: "Error updating time slot" });
    }
  });
  
  // Delete a time slot (admin only)
  app.delete("/api/admin/time-slots/:id", isAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteDjTimeSlot(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting time slot:", error);
      res.status(500).json({ message: "Error deleting time slot" });
    }
  });
  
  // Create HTTP server
  const httpServer = createServer(app);
  
  // Set up WebSocket server for live streaming
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  wss.on('connection', (ws) => {
    console.log('Client connected to WebSocket');
    
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        // Handle stream authentication
        if (data.type === 'auth') {
          const isValid = await storage.validateStreamKey(data.streamKey);
          if (isValid) {
            ws.send(JSON.stringify({ 
              type: 'auth_result', 
              success: true 
            }));
          } else {
            ws.send(JSON.stringify({ 
              type: 'auth_result', 
              success: false,
              message: 'Invalid stream key'
            }));
          }
        }
        
        // Handle audio stream data
        if (data.type === 'stream_data' && ws.readyState === WebSocket.OPEN) {
          // Broadcast to all connected clients
          wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'audio_data',
                streamId: data.streamId,
                audioData: data.audioData
              }));
            }
          });
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });
    
    ws.on('close', () => {
      console.log('Client disconnected from WebSocket');
    });
  });

  return httpServer;
}
