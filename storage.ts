import { 
  users,
  categories, 
  stations, 
  playbackHistory,
  nowPlaying,
  favorites,
  liveStreams,
  songRequests,
  chatMessages,
  notificationPreferences,
  notifications,
  User, 
  InsertUser,
  Category,
  InsertCategory,
  Station,
  InsertStation,
  PlaybackHistory,
  InsertPlaybackHistory,
  NowPlaying,
  InsertNowPlaying,
  Favorite,
  InsertFavorite,
  LiveStream,
  InsertLiveStream,
  SongRequest,
  InsertSongRequest,
  ChatMessage,
  InsertChatMessage,
  NotificationPreferences,
  InsertNotificationPreferences,
  Notification,
  InsertNotification
} from "@shared/schema";
import { randomBytes } from "crypto";
import session from "express-session";
import { db } from "./db";
import { eq, and, desc, asc } from "drizzle-orm";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";

export interface IStorage {
  // Session store for authentication
  sessionStore: session.Store;
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User>;
  getUsersByRole(role: string): Promise<User[]>;
  
  // DJ Time Slot methods
  getDjTimeSlots(): Promise<(DjTimeSlot & { dj: User })[]>;
  getDjTimeSlotById(id: number): Promise<(DjTimeSlot & { dj: User }) | undefined>;
  createDjTimeSlot(timeSlot: InsertDjTimeSlot): Promise<DjTimeSlot>;
  updateDjTimeSlot(id: number, timeSlot: Partial<InsertDjTimeSlot>): Promise<DjTimeSlot>;
  deleteDjTimeSlot(id: number): Promise<void>;
  
  // Category methods
  getCategories(): Promise<Category[]>;
  getCategoryById(id: number): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  
  // Station methods
  getStations(): Promise<Station[]>;
  getStationById(id: number): Promise<Station | undefined>;
  getStationsByCategory(categoryId: number): Promise<Station[]>;
  getFeaturedStations(): Promise<Station[]>;
  getTrendingStations(): Promise<Station[]>;
  createStation(station: InsertStation): Promise<Station>;
  
  // Playback history methods
  getPlaybackHistory(limit?: number): Promise<(PlaybackHistory & { station: Station })[]>;
  createPlaybackHistory(history: InsertPlaybackHistory): Promise<PlaybackHistory>;
  
  // Now playing methods
  getNowPlaying(stationId: number): Promise<NowPlaying | undefined>;
  createNowPlaying(nowPlaying: InsertNowPlaying): Promise<NowPlaying>;
  
  // Favorites methods
  getFavorites(userId: number): Promise<(Favorite & { station: Station })[]>;
  createFavorite(favorite: InsertFavorite): Promise<Favorite>;
  removeFavorite(userId: number, stationId: number): Promise<void>;
  isFavorite(userId: number, stationId: number): Promise<boolean>;
  
  // Live Stream methods
  getLiveStreams(): Promise<(LiveStream & { dj: User })[]>;
  getLiveStreamById(id: number): Promise<(LiveStream & { dj: User }) | undefined>;
  getLiveStreamsByDj(djId: number): Promise<LiveStream[]>;
  createLiveStream(liveStream: InsertLiveStream): Promise<LiveStream>;
  updateLiveStream(id: number, liveStream: Partial<InsertLiveStream>): Promise<LiveStream>;
  startLiveStream(id: number): Promise<LiveStream>;
  endLiveStream(id: number): Promise<LiveStream>;
  deleteLiveStream(id: number): Promise<void>;
  generateStreamKey(djId: number): Promise<string>;
  validateStreamKey(streamKey: string): Promise<boolean>;
  
  // Song Request and Dedication methods
  getSongRequests(userId?: number, status?: string, limit?: number): Promise<(SongRequest & { user: User })[]>;
  getSongRequestById(id: number): Promise<(SongRequest & { user: User }) | undefined>;
  createSongRequest(request: InsertSongRequest): Promise<SongRequest>;
  updateSongRequestStatus(id: number, status: string, response?: string): Promise<SongRequest>;
  
  // Chat Message methods
  getChatMessages(userId: number, limit?: number): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  
  // Notification methods
  getNotificationPreferences(userId: number): Promise<NotificationPreferences | undefined>;
  createOrUpdateNotificationPreferences(userId: number, preferences: Partial<InsertNotificationPreferences>): Promise<NotificationPreferences>;
  getNotifications(userId: number, unreadOnly?: boolean, limit?: number): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: number): Promise<Notification>;
  markAllNotificationsAsRead(userId: number): Promise<void>;
}

// Legacy in-memory storage implementation (to be removed)
class MemStorage implements IStorage {
  private users: Map<number, User>;
  private categories: Map<number, Category>;
  private stations: Map<number, Station>;
  private playbackHistory: PlaybackHistory[];
  private nowPlayingEntries: Map<number, NowPlaying>;
  private favorites: Favorite[];
  private liveStreams: Map<number, LiveStream>;
  private streamKeys: Map<string, number>; // Maps stream keys to DJ IDs
  private currentUserId: number;
  private currentCategoryId: number;
  private currentStationId: number;
  private currentHistoryId: number;
  private currentNowPlayingId: number;
  private currentFavoriteId: number;
  private currentLiveStreamId: number;

  constructor() {
    this.users = new Map();
    this.categories = new Map();
    this.stations = new Map();
    this.playbackHistory = [];
    this.nowPlayingEntries = new Map();
    this.favorites = [];
    this.liveStreams = new Map();
    this.streamKeys = new Map();
    this.currentUserId = 1;
    this.currentCategoryId = 1;
    this.currentStationId = 1;
    this.currentHistoryId = 1;
    this.currentNowPlayingId = 1;
    this.currentFavoriteId = 1;
    this.currentLiveStreamId = 1;
    this.seedData();
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const createdAt = new Date();
    const user: User = { 
      ...insertUser, 
      id, 
      role: insertUser.role || 'listener',
      displayName: insertUser.displayName || null,
      profileImage: insertUser.profileImage || null,
      bio: insertUser.bio || null,
      createdAt 
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: number, userData: Partial<InsertUser>): Promise<User> {
    const user = await this.getUser(id);
    if (!user) {
      throw new Error(`User with id ${id} not found`);
    }

    const updatedUser = { ...user, ...userData };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async getUsersByRole(role: string): Promise<User[]> {
    return Array.from(this.users.values()).filter(
      user => user.role === role
    );
  }

  // Category methods
  async getCategories(): Promise<Category[]> {
    return Array.from(this.categories.values());
  }

  async getCategoryById(id: number): Promise<Category | undefined> {
    return this.categories.get(id);
  }

  async createCategory(insertCategory: InsertCategory): Promise<Category> {
    const id = this.currentCategoryId++;
    const category: Category = { 
      ...insertCategory, 
      id,
      stationCount: insertCategory.stationCount !== undefined ? insertCategory.stationCount : 0 
    };
    this.categories.set(id, category);
    return category;
  }

  // Station methods
  async getStations(): Promise<Station[]> {
    return Array.from(this.stations.values());
  }

  async getStationById(id: number): Promise<Station | undefined> {
    return this.stations.get(id);
  }

  async getStationsByCategory(categoryId: number): Promise<Station[]> {
    return Array.from(this.stations.values()).filter(
      (station) => station.categoryId === categoryId,
    );
  }

  async getFeaturedStations(): Promise<Station[]> {
    return Array.from(this.stations.values()).filter(
      (station) => station.isFeatured,
    );
  }

  async getTrendingStations(): Promise<Station[]> {
    return Array.from(this.stations.values()).filter(
      (station) => station.isTrending,
    );
  }

  async createStation(insertStation: InsertStation): Promise<Station> {
    const id = this.currentStationId++;
    const station: Station = { 
      ...insertStation, 
      id,
      isLive: insertStation.isLive !== undefined ? insertStation.isLive : true,
      listenerCount: insertStation.listenerCount !== undefined ? insertStation.listenerCount : 0,
      isFeatured: insertStation.isFeatured !== undefined ? insertStation.isFeatured : false,
      isTrending: insertStation.isTrending !== undefined ? insertStation.isTrending : false
    };
    this.stations.set(id, station);
    return station;
  }

  // Playback history methods
  async getPlaybackHistory(limit: number = 10): Promise<(PlaybackHistory & { station: Station })[]> {
    return this.playbackHistory
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit)
      .map(history => {
        const station = this.stations.get(history.stationId);
        if (!station) {
          throw new Error(`Station with id ${history.stationId} not found`);
        }
        return { ...history, station };
      });
  }

  async createPlaybackHistory(insertHistory: InsertPlaybackHistory): Promise<PlaybackHistory> {
    const id = this.currentHistoryId++;
    const timestamp = new Date();
    const history: PlaybackHistory = { 
      ...insertHistory, 
      id, 
      timestamp,
      userId: insertHistory.userId ?? null
    };
    this.playbackHistory.push(history);
    return history;
  }

  // Now playing methods
  async getNowPlaying(stationId: number): Promise<NowPlaying | undefined> {
    const nowPlayingEntries = Array.from(this.nowPlayingEntries.values())
      .filter(entry => entry.stationId === stationId)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    
    return nowPlayingEntries[0];
  }

  async createNowPlaying(insertNowPlaying: InsertNowPlaying): Promise<NowPlaying> {
    const id = this.currentNowPlayingId++;
    const startTime = new Date();
    const nowPlaying: NowPlaying = { 
      ...insertNowPlaying, 
      id, 
      startTime,
      endTime: insertNowPlaying.endTime ?? null
    };
    this.nowPlayingEntries.set(id, nowPlaying);
    return nowPlaying;
  }

  // Favorites methods
  async getFavorites(userId: number): Promise<(Favorite & { station: Station })[]> {
    return this.favorites
      .filter(favorite => favorite.userId === userId)
      .map(favorite => {
        const station = this.stations.get(favorite.stationId);
        if (!station) {
          throw new Error(`Station with id ${favorite.stationId} not found`);
        }
        return { ...favorite, station };
      });
  }

  async createFavorite(insertFavorite: InsertFavorite): Promise<Favorite> {
    const id = this.currentFavoriteId++;
    const createdAt = new Date();
    const favorite: Favorite = { ...insertFavorite, id, createdAt };
    this.favorites.push(favorite);
    return favorite;
  }

  async removeFavorite(userId: number, stationId: number): Promise<void> {
    this.favorites = this.favorites.filter(
      favorite => !(favorite.userId === userId && favorite.stationId === stationId)
    );
  }

  async isFavorite(userId: number, stationId: number): Promise<boolean> {
    return this.favorites.some(
      favorite => favorite.userId === userId && favorite.stationId === stationId
    );
  }

  // Live Stream methods
  async getLiveStreams(): Promise<(LiveStream & { dj: User })[]> {
    return Array.from(this.liveStreams.values()).map(stream => {
      const dj = this.users.get(stream.djId);
      if (!dj) {
        throw new Error(`DJ with id ${stream.djId} not found`);
      }
      return { ...stream, dj };
    });
  }

  async getLiveStreamById(id: number): Promise<(LiveStream & { dj: User }) | undefined> {
    const stream = this.liveStreams.get(id);
    if (!stream) return undefined;

    const dj = this.users.get(stream.djId);
    if (!dj) {
      throw new Error(`DJ with id ${stream.djId} not found`);
    }

    return { ...stream, dj };
  }

  async getLiveStreamsByDj(djId: number): Promise<LiveStream[]> {
    return Array.from(this.liveStreams.values()).filter(
      stream => stream.djId === djId
    );
  }

  async createLiveStream(insertLiveStream: InsertLiveStream): Promise<LiveStream> {
    const id = this.currentLiveStreamId++;
    const createdAt = new Date();
    const streamKey = await this.generateStreamKey(insertLiveStream.djId);
    
    const liveStream: LiveStream = { 
      ...insertLiveStream,
      id,
      streamKey,
      description: insertLiveStream.description ?? null,
      coverImage: insertLiveStream.coverImage ?? null,
      isLive: insertLiveStream.isLive !== undefined ? insertLiveStream.isLive : false,
      startedAt: insertLiveStream.startedAt ?? null,
      endedAt: null,
      listenerCount: 0,
      createdAt
    };
    
    this.liveStreams.set(id, liveStream);
    this.streamKeys.set(streamKey, insertLiveStream.djId);
    return liveStream;
  }

  async updateLiveStream(id: number, updateData: Partial<InsertLiveStream>): Promise<LiveStream> {
    const liveStream = this.liveStreams.get(id);
    if (!liveStream) {
      throw new Error(`Live stream with id ${id} not found`);
    }

    const updatedStream = { ...liveStream, ...updateData };
    this.liveStreams.set(id, updatedStream);
    return updatedStream;
  }

  async startLiveStream(id: number): Promise<LiveStream> {
    const liveStream = this.liveStreams.get(id);
    if (!liveStream) {
      throw new Error(`Live stream with id ${id} not found`);
    }

    const startedAt = new Date();
    const updatedStream = { 
      ...liveStream, 
      isLive: true, 
      startedAt,
      endedAt: null
    };
    
    this.liveStreams.set(id, updatedStream);
    return updatedStream;
  }

  async endLiveStream(id: number): Promise<LiveStream> {
    const liveStream = this.liveStreams.get(id);
    if (!liveStream) {
      throw new Error(`Live stream with id ${id} not found`);
    }

    const endedAt = new Date();
    const updatedStream = { 
      ...liveStream, 
      isLive: false,
      endedAt
    };
    
    this.liveStreams.set(id, updatedStream);
    return updatedStream;
  }

  async deleteLiveStream(id: number): Promise<void> {
    if (!this.liveStreams.has(id)) {
      throw new Error(`Live stream with id ${id} not found`);
    }
    
    const stream = this.liveStreams.get(id);
    if (stream && stream.streamKey) {
      this.streamKeys.delete(stream.streamKey);
    }
    
    this.liveStreams.delete(id);
  }

  async generateStreamKey(djId: number): Promise<string> {
    // Generate a unique stream key
    const key = randomBytes(16).toString('hex');
    return key;
  }

  async validateStreamKey(streamKey: string): Promise<boolean> {
    return this.streamKeys.has(streamKey);
  }

  // Seed data for demo purposes
  private seedData() {
    // Seed categories
    const categoriesData: InsertCategory[] = [
      { name: "Music", icon: "music", stationCount: 421 },
      { name: "News", icon: "mic", stationCount: 178 },
      { name: "Talk Shows", icon: "message-square", stationCount: 145 },
      { name: "Sports", icon: "play-circle", stationCount: 92 },
      { name: "Education", icon: "book-open", stationCount: 64 },
      { name: "Entertainment", icon: "star", stationCount: 156 }
    ];

    categoriesData.forEach(category => {
      this.createCategory(category);
    });

    // Seed stations
    const stationsData: InsertStation[] = [
      {
        name: "Electronic Beats FM",
        description: "Current electronic dance music, featuring the latest house, techno, and trance tracks.",
        streamUrl: "https://example.com/stream/electronic-beats",
        imageUrl: "https://images.unsplash.com/photo-1571330735066-03aaa9429d89",
        logoUrl: "https://images.unsplash.com/photo-1614680376573-df3480f0c6ff",
        isLive: true,
        categoryId: 1,
        tags: "Electronic,Dance",
        listenerCount: 24500,
        isFeatured: true,
        isTrending: false
      },
      {
        name: "Global News Network",
        description: "24/7 coverage of breaking news, politics, business, and global events.",
        streamUrl: "https://example.com/stream/global-news",
        imageUrl: "https://images.unsplash.com/photo-1598550476439-6847785fcea6",
        logoUrl: "https://images.unsplash.com/photo-1495020689067-958852a7765e",
        isLive: true,
        categoryId: 2,
        tags: "News,Talk",
        listenerCount: 18700,
        isFeatured: true,
        isTrending: false
      },
      {
        name: "Smooth Jazz",
        description: "The finest jazz and instrumental tracks to relax and unwind with.",
        streamUrl: "https://example.com/stream/smooth-jazz",
        imageUrl: "https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f",
        logoUrl: "https://images.unsplash.com/photo-1511379938547-c1f69419868d",
        isLive: true,
        categoryId: 1,
        tags: "Jazz,Relaxation",
        listenerCount: 12300,
        isFeatured: true,
        isTrending: false
      },
      {
        name: "Pop Hits Radio",
        description: "Top 40 hits and the latest pop music.",
        streamUrl: "https://example.com/stream/pop-hits",
        imageUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f",
        logoUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f",
        isLive: true,
        categoryId: 1,
        tags: "Pop,Top 40",
        listenerCount: 32100,
        isFeatured: false,
        isTrending: true
      },
      {
        name: "Classic Rock Legends",
        description: "The greatest rock hits from the 70s and 80s.",
        streamUrl: "https://example.com/stream/classic-rock",
        imageUrl: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad",
        logoUrl: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad",
        isLive: true,
        categoryId: 1,
        tags: "Rock,70s-80s",
        listenerCount: 28700,
        isFeatured: false,
        isTrending: true
      },
      {
        name: "Urban Beats",
        description: "The hottest hip-hop and R&B tracks.",
        streamUrl: "https://example.com/stream/urban-beats",
        imageUrl: "https://images.unsplash.com/photo-1526478806334-5fd488fcaabc",
        logoUrl: "https://images.unsplash.com/photo-1526478806334-5fd488fcaabc",
        isLive: true,
        categoryId: 1,
        tags: "Hip-Hop,R&B",
        listenerCount: 22400,
        isFeatured: false,
        isTrending: true
      },
      {
        name: "Country Roads",
        description: "The best country music from classic to contemporary.",
        streamUrl: "https://example.com/stream/country-roads",
        imageUrl: "https://images.unsplash.com/photo-1605279103686-406b9d1b5c70",
        logoUrl: "https://images.unsplash.com/photo-1605279103686-406b9d1b5c70",
        isLive: true,
        categoryId: 1,
        tags: "Country,Folk",
        listenerCount: 19800,
        isFeatured: false,
        isTrending: true
      },
      {
        name: "Indie Discoveries",
        description: "Discover the best independent and alternative music.",
        streamUrl: "https://example.com/stream/indie-discoveries",
        imageUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4",
        logoUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4",
        isLive: true,
        categoryId: 1,
        tags: "Alternative,Indie",
        listenerCount: 15300,
        isFeatured: false,
        isTrending: true
      },
      {
        name: "Jazz FM",
        description: "The best of classical and contemporary jazz.",
        streamUrl: "https://example.com/stream/jazz-fm",
        imageUrl: "https://images.unsplash.com/photo-1511379938547-c1f69419868d",
        logoUrl: "https://images.unsplash.com/photo-1511379938547-c1f69419868d",
        isLive: true,
        categoryId: 1,
        tags: "Jazz,Blues",
        listenerCount: 11200,
        isFeatured: false,
        isTrending: false
      },
      {
        name: "NPR News",
        description: "In-depth news coverage and analysis.",
        streamUrl: "https://example.com/stream/npr-news",
        imageUrl: "https://images.unsplash.com/photo-1614644147798-f8c0fc9da7f6",
        logoUrl: "https://images.unsplash.com/photo-1614644147798-f8c0fc9da7f6",
        isLive: true,
        categoryId: 2,
        tags: "News,Politics",
        listenerCount: 21500,
        isFeatured: false,
        isTrending: false
      },
      {
        name: "Rock 101",
        description: "The home of rock and alternative music.",
        streamUrl: "https://example.com/stream/rock-101",
        imageUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819",
        logoUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819",
        isLive: true,
        categoryId: 1,
        tags: "Rock,Alternative",
        listenerCount: 18900,
        isFeatured: false,
        isTrending: false
      }
    ];

    stationsData.forEach(station => {
      this.createStation(station);
    });

    // Seed now playing
    const nowPlayingData: InsertNowPlaying[] = [
      {
        stationId: 1,
        trackTitle: "Summer Vibes",
        artist: "DJ Horizon",
        endTime: new Date(Date.now() + 4 * 60 * 1000) // 4 minutes from now
      },
      {
        stationId: 2,
        trackTitle: "Breaking News",
        artist: "News Anchor",
        endTime: null
      },
      {
        stationId: 3,
        trackTitle: "Smooth Sax Solo",
        artist: "Jazz Masters",
        endTime: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes from now
      }
    ];

    nowPlayingData.forEach(nowPlaying => {
      this.createNowPlaying(nowPlaying);
    });

    // Seed playback history
    const historyData: InsertPlaybackHistory[] = [
      { stationId: 9, userId: null },
      { stationId: 10, userId: null },
      { stationId: 11, userId: null }
    ];

    historyData.forEach(history => {
      this.createPlaybackHistory(history);
    });
  }
}

import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";
import connectPg from "connect-pg-simple";
import session from "express-session";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

// Database-backed storage implementation
export class DatabaseStorage implements IStorage {
  public sessionStore: session.SessionStore;

  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true 
    });
  }

  // === User methods ===
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: number, userData: Partial<InsertUser>): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  async getUsersByRole(role: string): Promise<User[]> {
    return db.select().from(users).where(eq(users.role, role));
  }

  // === DJ Time Slot methods ===
  async getDjTimeSlots(): Promise<(DjTimeSlot & { dj: User })[]> {
    try {
      const timeSlots = await db.select().from(djTimeSlots);
      const result = [];
      
      for (const slot of timeSlots) {
        const dj = await this.getUser(slot.djId);
        if (dj) {
          result.push({
            ...slot,
            dj
          });
        }
      }
      
      // Sort by day of week and start time
      return result.sort((a, b) => {
        if (a.dayOfWeek !== b.dayOfWeek) {
          return a.dayOfWeek - b.dayOfWeek;
        }
        return a.startTime.localeCompare(b.startTime);
      });
    } catch (error) {
      console.error("Error getting DJ time slots:", error);
      return [];
    }
  }
  
  async getDjTimeSlotById(id: number): Promise<(DjTimeSlot & { dj: User }) | undefined> {
    try {
      const [slot] = await db.select().from(djTimeSlots).where(eq(djTimeSlots.id, id));
      
      if (!slot) {
        return undefined;
      }
      
      const dj = await this.getUser(slot.djId);
      
      if (!dj) {
        return undefined;
      }
      
      return {
        ...slot,
        dj
      };
    } catch (error) {
      console.error("Error getting DJ time slot by ID:", error);
      return undefined;
    }
  }
  
  async createDjTimeSlot(timeSlot: InsertDjTimeSlot): Promise<DjTimeSlot> {
    try {
      const [newSlot] = await db
        .insert(djTimeSlots)
        .values(timeSlot)
        .returning();
      return newSlot;
    } catch (error) {
      console.error("Error creating DJ time slot:", error);
      throw error;
    }
  }
  
  async updateDjTimeSlot(id: number, timeSlot: Partial<InsertDjTimeSlot>): Promise<DjTimeSlot> {
    try {
      const [updatedSlot] = await db
        .update(djTimeSlots)
        .set({
          ...timeSlot,
          updatedAt: new Date()
        })
        .where(eq(djTimeSlots.id, id))
        .returning();
      
      if (!updatedSlot) {
        throw new Error(`DJ time slot with ID ${id} not found`);
      }
      
      return updatedSlot;
    } catch (error) {
      console.error("Error updating DJ time slot:", error);
      throw error;
    }
  }
  
  async deleteDjTimeSlot(id: number): Promise<void> {
    try {
      await db
        .delete(djTimeSlots)
        .where(eq(djTimeSlots.id, id));
    } catch (error) {
      console.error("Error deleting DJ time slot:", error);
      throw error;
    }
  }

  // === Category methods ===
  async getCategories(): Promise<Category[]> {
    return db.select().from(categories);
  }

  async getCategoryById(id: number): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.id, id));
    return category;
  }

  async createCategory(insertCategory: InsertCategory): Promise<Category> {
    const [category] = await db.insert(categories).values(insertCategory).returning();
    return category;
  }

  // === Station methods ===
  async getStations(): Promise<Station[]> {
    return db.select().from(stations);
  }

  async getStationById(id: number): Promise<Station | undefined> {
    const [station] = await db.select().from(stations).where(eq(stations.id, id));
    return station;
  }

  async getStationsByCategory(categoryId: number): Promise<Station[]> {
    return db.select().from(stations).where(eq(stations.categoryId, categoryId));
  }

  async getFeaturedStations(): Promise<Station[]> {
    return db.select().from(stations).where(eq(stations.featured, true)).limit(6);
  }

  async getTrendingStations(): Promise<Station[]> {
    return db.select().from(stations).orderBy(desc(stations.listenerCount)).limit(6);
  }

  async createStation(insertStation: InsertStation): Promise<Station> {
    const [station] = await db.insert(stations).values(insertStation).returning();
    return station;
  }

  // === Playback history methods ===
  async getPlaybackHistory(limit: number = 10): Promise<(PlaybackHistory & { station: Station })[]> {
    const results = await db
      .select({
        history: playbackHistory,
        station: stations
      })
      .from(playbackHistory)
      .innerJoin(stations, eq(playbackHistory.stationId, stations.id))
      .orderBy(desc(playbackHistory.timestamp))
      .limit(limit);

    return results.map(r => ({ ...r.history, station: r.station }));
  }

  async createPlaybackHistory(insertHistory: InsertPlaybackHistory): Promise<PlaybackHistory> {
    const [history] = await db.insert(playbackHistory).values(insertHistory).returning();
    return history;
  }

  // === Now playing methods ===
  async getNowPlaying(stationId: number): Promise<NowPlaying | undefined> {
    const [nowPlayingItem] = await db
      .select()
      .from(nowPlaying)
      .where(eq(nowPlaying.stationId, stationId));
    return nowPlayingItem;
  }

  async createNowPlaying(insertNowPlaying: InsertNowPlaying): Promise<NowPlaying> {
    // Delete any existing now playing for this station
    await db
      .delete(nowPlaying)
      .where(eq(nowPlaying.stationId, insertNowPlaying.stationId));
      
    // Insert the new now playing entry
    const [nowPlayingItem] = await db
      .insert(nowPlaying)
      .values(insertNowPlaying)
      .returning();
    return nowPlayingItem;
  }

  // === Favorites methods ===
  async getFavorites(userId: number): Promise<(Favorite & { station: Station })[]> {
    const results = await db
      .select({
        favorite: favorites,
        station: stations
      })
      .from(favorites)
      .innerJoin(stations, eq(favorites.stationId, stations.id))
      .where(eq(favorites.userId, userId));

    return results.map(r => ({ ...r.favorite, station: r.station }));
  }

  async createFavorite(insertFavorite: InsertFavorite): Promise<Favorite> {
    // Check if it already exists
    const [existing] = await db
      .select()
      .from(favorites)
      .where(
        and(
          eq(favorites.userId, insertFavorite.userId),
          eq(favorites.stationId, insertFavorite.stationId)
        )
      );

    if (existing) {
      return existing;
    }

    const [favorite] = await db.insert(favorites).values(insertFavorite).returning();
    return favorite;
  }

  async removeFavorite(userId: number, stationId: number): Promise<void> {
    await db
      .delete(favorites)
      .where(
        and(
          eq(favorites.userId, userId),
          eq(favorites.stationId, stationId)
        )
      );
  }

  async isFavorite(userId: number, stationId: number): Promise<boolean> {
    const [favorite] = await db
      .select()
      .from(favorites)
      .where(
        and(
          eq(favorites.userId, userId),
          eq(favorites.stationId, stationId)
        )
      );

    return !!favorite;
  }

  // === Live Stream methods ===
  async getLiveStreams(): Promise<(LiveStream & { dj: User })[]> {
    const results = await db
      .select({
        liveStream: liveStreams,
        dj: users
      })
      .from(liveStreams)
      .innerJoin(users, eq(liveStreams.djId, users.id));

    return results.map(r => ({ ...r.liveStream, dj: r.dj }));
  }

  async getLiveStreamById(id: number): Promise<(LiveStream & { dj: User }) | undefined> {
    const [result] = await db
      .select({
        liveStream: liveStreams,
        dj: users
      })
      .from(liveStreams)
      .innerJoin(users, eq(liveStreams.djId, users.id))
      .where(eq(liveStreams.id, id));

    if (!result) return undefined;
    return { ...result.liveStream, dj: result.dj };
  }

  async getLiveStreamsByDj(djId: number): Promise<LiveStream[]> {
    return db
      .select()
      .from(liveStreams)
      .where(eq(liveStreams.djId, djId));
  }

  async createLiveStream(insertLiveStream: InsertLiveStream): Promise<LiveStream> {
    const streamKey = await this.generateStreamKey(insertLiveStream.djId);
    
    const [liveStream] = await db
      .insert(liveStreams)
      .values({
        ...insertLiveStream,
        streamKey,
        isLive: insertLiveStream.isLive ?? false,
        description: insertLiveStream.description ?? null,
        coverImage: insertLiveStream.coverImage ?? null,
        startedAt: insertLiveStream.startedAt ?? null,
        endedAt: null,
        listenerCount: 0,
      })
      .returning();
      
    return liveStream;
  }

  async updateLiveStream(id: number, updateData: Partial<InsertLiveStream>): Promise<LiveStream> {
    const [updatedStream] = await db
      .update(liveStreams)
      .set(updateData)
      .where(eq(liveStreams.id, id))
      .returning();
      
    return updatedStream;
  }

  async startLiveStream(id: number): Promise<LiveStream> {
    const now = new Date();
    const [liveStream] = await db
      .update(liveStreams)
      .set({ 
        isLive: true, 
        startedAt: now, 
        endedAt: null 
      })
      .where(eq(liveStreams.id, id))
      .returning();
      
    return liveStream;
  }

  async endLiveStream(id: number): Promise<LiveStream> {
    const now = new Date();
    const [liveStream] = await db
      .update(liveStreams)
      .set({ 
        isLive: false, 
        endedAt: now 
      })
      .where(eq(liveStreams.id, id))
      .returning();
      
    return liveStream;
  }

  async deleteLiveStream(id: number): Promise<void> {
    await db.delete(liveStreams).where(eq(liveStreams.id, id));
  }

  async generateStreamKey(djId: number): Promise<string> {
    // Generate a random stream key
    const key = Math.random().toString(36).substring(2, 15) + 
                Math.random().toString(36).substring(2, 15);
    
    // Store in the database (we'll create a simple table for this)
    // For now, we'll just return the key
    return `live_${djId}_${key}`;
  }

  async validateStreamKey(streamKey: string): Promise<boolean> {
    // Extract the DJ ID from the stream key
    const match = streamKey.match(/^live_(\d+)_/);
    if (!match) return false;
    
    const djId = parseInt(match[1]);
    
    // Check if there's an active stream with this key and DJ ID
    const [stream] = await db
      .select()
      .from(liveStreams)
      .where(
        and(
          eq(liveStreams.djId, djId),
          eq(liveStreams.streamKey, streamKey),
          eq(liveStreams.isLive, true)
        )
      );
      
    return !!stream;
  }

  // Song Requests and Dedications
  async getSongRequests(userId?: number, status?: string, limit: number = 20): Promise<(SongRequest & { user: User })[]> {
    let query = db
      .select({
        request: songRequests,
        user: users,
      })
      .from(songRequests)
      .leftJoin(users, eq(songRequests.userId, users.id))
      .orderBy(desc(songRequests.requestedAt));
    
    if (userId) {
      query = query.where(eq(songRequests.userId, userId));
    }
    
    if (status) {
      query = query.where(eq(songRequests.status, status));
    }
    
    const results = await query.limit(limit);
    
    return results.map(r => ({
      ...r.request,
      user: r.user,
    }));
  }

  async getSongRequestById(id: number): Promise<(SongRequest & { user: User }) | undefined> {
    const [result] = await db
      .select({
        request: songRequests,
        user: users,
      })
      .from(songRequests)
      .leftJoin(users, eq(songRequests.userId, users.id))
      .where(eq(songRequests.id, id));
    
    if (!result) return undefined;
    
    return {
      ...result.request,
      user: result.user,
    };
  }

  async createSongRequest(request: InsertSongRequest): Promise<SongRequest> {
    const [songRequest] = await db
      .insert(songRequests)
      .values(request)
      .returning();
    return songRequest;
  }

  async updateSongRequestStatus(id: number, status: string, response?: string): Promise<SongRequest> {
    const [songRequest] = await db
      .update(songRequests)
      .set({
        status,
        response,
        responseAt: new Date(),
      })
      .where(eq(songRequests.id, id))
      .returning();
    return songRequest;
  }

  // Chat Message methods
  async getChatMessages(userId: number, limit: number = 50): Promise<ChatMessage[]> {
    return await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.userId, userId))
      .orderBy(asc(chatMessages.timestamp))
      .limit(limit);
  }

  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const [chatMessage] = await db
      .insert(chatMessages)
      .values(message)
      .returning();
    return chatMessage;
  }

  // Notification Preferences
  async getNotificationPreferences(userId: number): Promise<NotificationPreferences | undefined> {
    const [prefs] = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId));
    
    return prefs || undefined;
  }

  async createOrUpdateNotificationPreferences(
    userId: number, 
    preferences: Partial<InsertNotificationPreferences>
  ): Promise<NotificationPreferences> {
    // Check if preferences already exist
    const existing = await this.getNotificationPreferences(userId);
    
    if (existing) {
      // Update existing preferences
      const [updated] = await db
        .update(notificationPreferences)
        .set({
          ...preferences,
          updatedAt: new Date(),
        })
        .where(eq(notificationPreferences.userId, userId))
        .returning();
      return updated;
    } else {
      // Create new preferences
      const [created] = await db
        .insert(notificationPreferences)
        .values({
          userId,
          ...preferences,
        })
        .returning();
      return created;
    }
  }

  // Notifications
  async getNotifications(userId: number, unreadOnly: boolean = false, limit: number = 20): Promise<Notification[]> {
    let query = db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));
    
    if (unreadOnly) {
      query = query.where(eq(notifications.isRead, false));
    }
    
    return await query.limit(limit);
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    // Check user notification preferences
    const prefs = await this.getNotificationPreferences(notification.userId);
    
    // If user has opted out of this notification type, don't create it
    if (prefs) {
      const type = notification.type;
      if (
        (type === 'contests' && !prefs.contestsEnabled) ||
        (type === 'promotions' && !prefs.promotionsEnabled) ||
        (type === 'events' && !prefs.eventsEnabled) ||
        (type === 'new_music' && !prefs.newMusicEnabled) ||
        (type === 'dj_notification' && !prefs.djNotificationsEnabled)
      ) {
        // Create a dummy notification that won't be shown but satisfies the return type
        return {
          id: -1,
          userId: notification.userId,
          title: notification.title,
          content: notification.content,
          type: notification.type,
          isRead: true,
          createdAt: new Date(),
          expiresAt: notification.expiresAt,
        };
      }
    }
    
    const [created] = await db
      .insert(notifications)
      .values(notification)
      .returning();
    return created;
  }

  async markNotificationAsRead(id: number): Promise<Notification> {
    const [notification] = await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id))
      .returning();
    return notification;
  }

  async markAllNotificationsAsRead(userId: number): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, userId));
  }
}

// Export a singleton instance of the storage implementation
export const storage = new DatabaseStorage();
