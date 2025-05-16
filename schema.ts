import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("listener"), // Can be "listener", "dj", or "admin"
  displayName: text("display_name"),
  profileImage: text("profile_image"),
  bio: text("bio"),
  employeeId: text("employee_id").unique(), // 6-8 digit alphanumeric ID for DJs
  isApproved: boolean("is_approved").default(false), // For DJ account approval
  isActive: boolean("is_active").default(true), // For account activation/deactivation
  accountStatus: text("account_status").default("active"), // active, locked, deactivated
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  role: true,
  displayName: true,
  profileImage: true,
  bio: true,
  employeeId: true,
  isApproved: true,
  isActive: true,
  accountStatus: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// DJ Time Slots
export const djTimeSlots = pgTable("dj_time_slots", {
  id: serial("id").primaryKey(),
  djId: integer("dj_id").notNull().references(() => users.id),
  dayOfWeek: integer("day_of_week").notNull(), // 0-6 (Sunday-Saturday)
  startTime: text("start_time").notNull(), // Format: HH:MM in 24hr format
  endTime: text("end_time").notNull(), // Format: HH:MM in 24hr format
  title: text("title").notNull(), // Show title
  description: text("description"),
  isRecurring: boolean("is_recurring").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertDjTimeSlotSchema = createInsertSchema(djTimeSlots).pick({
  djId: true,
  dayOfWeek: true,
  startTime: true,
  endTime: true,
  title: true,
  description: true,
  isRecurring: true,
});

export type InsertDjTimeSlot = z.infer<typeof insertDjTimeSlotSchema>;
export type DjTimeSlot = typeof djTimeSlots.$inferSelect;

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  icon: text("icon").notNull(),
  stationCount: integer("station_count").notNull().default(0),
});

export const insertCategorySchema = createInsertSchema(categories).pick({
  name: true,
  icon: true,
  stationCount: true,
});

export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;

export const stations = pgTable("stations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  streamUrl: text("stream_url").notNull(),
  imageUrl: text("image_url").notNull(),
  logoUrl: text("logo_url").notNull(),
  isLive: boolean("is_live").notNull().default(true),
  categoryId: integer("category_id").notNull(),
  tags: text("tags").notNull(),
  listenerCount: integer("listener_count").notNull().default(0),
  isFeatured: boolean("is_featured").notNull().default(false),
  isTrending: boolean("is_trending").notNull().default(false),
});

export const insertStationSchema = createInsertSchema(stations).pick({
  name: true,
  description: true,
  streamUrl: true,
  imageUrl: true,
  logoUrl: true,
  isLive: true,
  categoryId: true,
  tags: true,
  listenerCount: true,
  isFeatured: true,
  isTrending: true,
});

export type InsertStation = z.infer<typeof insertStationSchema>;
export type Station = typeof stations.$inferSelect;

export const playbackHistory = pgTable("playback_history", {
  id: serial("id").primaryKey(),
  stationId: integer("station_id").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  userId: integer("user_id"),
});

export const insertPlaybackHistorySchema = createInsertSchema(playbackHistory).pick({
  stationId: true,
  userId: true,
});

export type InsertPlaybackHistory = z.infer<typeof insertPlaybackHistorySchema>;
export type PlaybackHistory = typeof playbackHistory.$inferSelect;

export const nowPlaying = pgTable("now_playing", {
  id: serial("id").primaryKey(),
  stationId: integer("station_id").notNull(),
  trackTitle: text("track_title").notNull(),
  artist: text("artist").notNull(),
  startTime: timestamp("start_time").notNull().defaultNow(),
  endTime: timestamp("end_time"),
});

export const insertNowPlayingSchema = createInsertSchema(nowPlaying).pick({
  stationId: true,
  trackTitle: true,
  artist: true,
  endTime: true,
});

export type InsertNowPlaying = z.infer<typeof insertNowPlayingSchema>;
export type NowPlaying = typeof nowPlaying.$inferSelect;

export const favorites = pgTable("favorites", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  stationId: integer("station_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertFavoriteSchema = createInsertSchema(favorites).pick({
  userId: true,
  stationId: true,
});

export type InsertFavorite = z.infer<typeof insertFavoriteSchema>;
export type Favorite = typeof favorites.$inferSelect;

// Live Stream Sessions for DJs
export const liveStreams = pgTable("live_streams", {
  id: serial("id").primaryKey(),
  djId: integer("dj_id").notNull(), // References users table
  title: text("title").notNull(),
  description: text("description"),
  coverImage: text("cover_image"),
  streamKey: text("stream_key").notNull(), // Unique key for streaming
  isLive: boolean("is_live").notNull().default(false),
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  categoryId: integer("category_id").notNull(),
  listenerCount: integer("listener_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertLiveStreamSchema = createInsertSchema(liveStreams).pick({
  djId: true,
  title: true,
  description: true,
  coverImage: true,
  streamKey: true,
  isLive: true,
  startedAt: true,
  endedAt: true,
  categoryId: true,
});

export type InsertLiveStream = z.infer<typeof insertLiveStreamSchema>;
export type LiveStream = typeof liveStreams.$inferSelect;

// Song Requests and Dedications
export const songRequests = pgTable("song_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(), // User who made the request
  songTitle: text("song_title").notNull(),
  artist: text("artist").notNull(),
  dedicatedTo: text("dedicated_to"), // Optional dedication recipient
  message: text("message"), // Optional dedication message
  requestedAt: timestamp("requested_at").notNull().defaultNow(),
  status: text("status").notNull().default("pending"), // pending, approved, played, rejected
  response: text("response"), // DJ or AI response to the request
  responseAt: timestamp("response_at"),
});

export const insertSongRequestSchema = createInsertSchema(songRequests).pick({
  userId: true,
  songTitle: true,
  artist: true,
  dedicatedTo: true,
  message: true,
  status: true,
});

export type InsertSongRequest = z.infer<typeof insertSongRequestSchema>;
export type SongRequest = typeof songRequests.$inferSelect;

// AI Chat Messages
export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  content: text("content").notNull(),
  isFromUser: boolean("is_from_user").notNull(), // true if from user, false if AI response
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  songRequestId: integer("song_request_id"), // Optional reference to a song request
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).pick({
  userId: true,
  content: true,
  isFromUser: true,
  songRequestId: true,
});

export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

// User Notification Preferences
export const notificationPreferences = pgTable("notification_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  contestsEnabled: boolean("contests_enabled").notNull().default(false),
  promotionsEnabled: boolean("promotions_enabled").notNull().default(false),
  eventsEnabled: boolean("events_enabled").notNull().default(false),
  newMusicEnabled: boolean("new_music_enabled").notNull().default(false),
  djNotificationsEnabled: boolean("dj_notifications_enabled").notNull().default(false),
  emailNotificationsEnabled: boolean("email_notifications_enabled").notNull().default(false),
  pushNotificationsEnabled: boolean("push_notifications_enabled").notNull().default(false),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertNotificationPreferencesSchema = createInsertSchema(notificationPreferences).pick({
  userId: true,
  contestsEnabled: true,
  promotionsEnabled: true,
  eventsEnabled: true,
  newMusicEnabled: true,
  djNotificationsEnabled: true,
  emailNotificationsEnabled: true,
  pushNotificationsEnabled: true,
});

export type InsertNotificationPreferences = z.infer<typeof insertNotificationPreferencesSchema>;
export type NotificationPreferences = typeof notificationPreferences.$inferSelect;

// Notifications
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  type: text("type").notNull(), // contests, promotions, events, new_music, dj_notification
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"),
});

export const insertNotificationSchema = createInsertSchema(notifications).pick({
  userId: true,
  title: true,
  content: true,
  type: true,
  expiresAt: true,
});

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;
