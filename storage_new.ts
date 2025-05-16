import { 
  users,
  categories, 
  stations, 
  playbackHistory,
  nowPlaying,
  favorites,
  liveStreams,
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
  InsertLiveStream
} from "@shared/schema";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { db, pool } from "./db";
import { eq, desc, and } from "drizzle-orm";
import createMemoryStore from "memorystore";

// Interface defining storage methods
export interface IStorage {
  // Session store for authentication
  sessionStore: session.Store;
  
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User>;
  getUsersByRole(role: string): Promise<User[]>;
  
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
}

const PostgresSessionStore = connectPg(session);
const MemoryStore = createMemoryStore(session);

// Database-backed storage implementation
export class DatabaseStorage implements IStorage {
  public sessionStore: session.Store;

  constructor() {
    // Use PostgreSQL for session storage in production
    if (process.env.NODE_ENV === "production") {
      this.sessionStore = new PostgresSessionStore({ 
        pool, 
        createTableIfMissing: true 
      });
    } else {
      // Use memory store for development
      this.sessionStore = new MemoryStore({
        checkPeriod: 86400000, // prune expired entries every 24h
      });
    }
    
    // Seed the database in development
    if (process.env.NODE_ENV === "development") {
      this.seedDatabase().catch(console.error);
    }
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
    return db.select().from(stations).where(eq(stations.isFeatured, true)).limit(6);
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
  
  // Method to seed the database with initial data
  private async seedDatabase() {
    try {
      // Check if categories exist
      const existingCategories = await this.getCategories();
      if (existingCategories.length > 0) {
        console.log("Database already seeded, skipping...");
        return;
      }
      
      console.log("Seeding database with initial data...");
      
      // Seed categories
      const categoriesData: InsertCategory[] = [
        { name: "Music", icon: "music", stationCount: 0 },
        { name: "News", icon: "newspaper", stationCount: 0 },
        { name: "Sports", icon: "trophy", stationCount: 0 },
        { name: "Talk", icon: "mic", stationCount: 0 },
        { name: "Culture", icon: "globe", stationCount: 0 }
      ];
      
      const seededCategories = await Promise.all(
        categoriesData.map(category => this.createCategory(category))
      );
      
      // Seed stations
      const stationsData: InsertStation[] = [
        {
          name: "Electronic Beats FM",
          description: "The best electronic music from around the world",
          logoUrl: "https://placehold.co/300x300/d946ef/ffffff?text=Electronic+Beats",
          streamUrl: "https://stream.electronicbeats.fm",
          imageUrl: "https://placehold.co/800x400/d946ef/ffffff?text=Electronic+Beats",
          categoryId: seededCategories[0].id, // Music
          isFeatured: true,
          tags: JSON.stringify(["electronic", "dance", "techno"]),
          isLive: true,
          isTrending: false,
          listenerCount: 1250
        },
        {
          name: "Jazz Lounge",
          description: "Smooth jazz for your relaxation",
          logoUrl: "https://placehold.co/300x300/2563eb/ffffff?text=Jazz+Lounge",
          streamUrl: "https://stream.jazzlounge.fm",
          imageUrl: "https://placehold.co/800x400/2563eb/ffffff?text=Jazz+Lounge",
          categoryId: seededCategories[0].id, // Music
          isFeatured: true,
          tags: JSON.stringify(["jazz", "smooth", "relax"]),
          isLive: true,
          isTrending: false,
          listenerCount: 850
        },
        {
          name: "News 24/7",
          description: "Breaking news and in-depth stories all day",
          logoUrl: "https://placehold.co/300x300/dc2626/ffffff?text=News+24%2F7",
          streamUrl: "https://stream.news247.com",
          imageUrl: "https://placehold.co/800x400/dc2626/ffffff?text=News+24%2F7",
          categoryId: seededCategories[1].id, // News
          isFeatured: true,
          tags: JSON.stringify(["news", "politics", "current events"]),
          isLive: true,
          isTrending: true,
          listenerCount: 3200
        },
        {
          name: "Sports Talk Radio",
          description: "All sports, all the time",
          logoUrl: "https://placehold.co/300x300/16a34a/ffffff?text=Sports+Talk",
          streamUrl: "https://stream.sportstalk.com",
          imageUrl: "https://placehold.co/800x400/16a34a/ffffff?text=Sports+Talk",
          categoryId: seededCategories[2].id, // Sports
          isFeatured: false,
          tags: JSON.stringify(["sports", "commentary", "live"]),
          isLive: true,
          isTrending: true,
          listenerCount: 1800
        },
        {
          name: "Classical Symphony",
          description: "The world's greatest classical music",
          logoUrl: "https://placehold.co/300x300/ca8a04/ffffff?text=Classical",
          streamUrl: "https://stream.classicalsymphony.org",
          imageUrl: "https://placehold.co/800x400/ca8a04/ffffff?text=Classical",
          categoryId: seededCategories[0].id, // Music
          isFeatured: false,
          tags: JSON.stringify(["classical", "symphony", "orchestra"]),
          isLive: true,
          isTrending: false,
          listenerCount: 750
        },
        {
          name: "World Culture Network",
          description: "Exploring cultures and traditions from around the globe",
          logoUrl: "https://placehold.co/300x300/0891b2/ffffff?text=World+Culture",
          streamUrl: "https://stream.worldculture.org",
          websiteUrl: "https://worldculture.org",
          categoryId: seededCategories[4].id, // Culture
          isFeatured: true,
          tags: ["culture", "world", "traditions"],
          location: "Paris, France",
          language: "English",
          listenerCount: 950
        },
        {
          name: "The Podcast Station",
          description: "The best podcasts curated for you",
          logoUrl: "https://placehold.co/300x300/9333ea/ffffff?text=Podcast+Station",
          streamUrl: "https://stream.podcaststation.com",
          websiteUrl: "https://podcaststation.com",
          categoryId: seededCategories[3].id, // Talk
          isFeatured: false,
          tags: ["podcast", "talk", "stories"],
          location: "Los Angeles, USA",
          language: "English",
          listenerCount: 2100
        },
        {
          name: "Pop Hits Radio",
          description: "Today's top 40 hits",
          logoUrl: "https://placehold.co/300x300/f97316/ffffff?text=Pop+Hits",
          streamUrl: "https://stream.pophitsradio.com",
          websiteUrl: "https://pophitsradio.com",
          categoryId: seededCategories[0].id, // Music
          isFeatured: false,
          tags: ["pop", "top 40", "hits"],
          location: "Miami, USA",
          language: "English",
          listenerCount: 4200
        },
        {
          name: "Reggae Vibes",
          description: "Positive reggae music all day",
          logoUrl: "https://placehold.co/300x300/65a30d/ffffff?text=Reggae+Vibes",
          streamUrl: "https://stream.reggaevibes.fm",
          websiteUrl: "https://reggaevibes.fm",
          categoryId: seededCategories[0].id, // Music
          isFeatured: true,
          tags: ["reggae", "jamaica", "roots"],
          location: "Kingston, Jamaica",
          language: "English",
          listenerCount: 1100
        },
        {
          name: "Science Today",
          description: "Exploring the latest in science and technology",
          logoUrl: "https://placehold.co/300x300/0369a1/ffffff?text=Science+Today",
          streamUrl: "https://stream.sciencetoday.org",
          websiteUrl: "https://sciencetoday.org",
          categoryId: seededCategories[3].id, // Talk
          isFeatured: false,
          tags: ["science", "technology", "education"],
          location: "Boston, USA",
          language: "English",
          listenerCount: 1350
        },
        {
          name: "Rock Classics",
          description: "The best rock from the 60s to today",
          logoUrl: "https://placehold.co/300x300/b91c1c/ffffff?text=Rock+Classics",
          streamUrl: "https://stream.rockclassics.fm",
          websiteUrl: "https://rockclassics.fm",
          categoryId: seededCategories[0].id, // Music
          isFeatured: true,
          tags: ["rock", "classic rock", "hard rock"],
          location: "London, UK",
          language: "English",
          listenerCount: 3100
        },
        {
          name: "International News",
          description: "Global news and analysis",
          logoUrl: "https://placehold.co/300x300/4f46e5/ffffff?text=International+News",
          streamUrl: "https://stream.internationalnews.org",
          websiteUrl: "https://internationalnews.org",
          categoryId: seededCategories[1].id, // News
          isFeatured: false,
          tags: ["news", "international", "politics"],
          location: "Tokyo, Japan",
          language: "English",
          listenerCount: 2300
        }
      ];
      
      await Promise.all(
        stationsData.map(station => this.createStation(station))
      );
      
      // Seed playback history
      const historyData: InsertPlaybackHistory[] = [
        { stationId: 9, userId: null },
        { stationId: 10, userId: null },
        { stationId: 11, userId: null }
      ];
      
      await Promise.all(
        historyData.map(history => this.createPlaybackHistory(history))
      );
      
      // Seed now playing data
      const nowPlayingData: InsertNowPlaying[] = [
        {
          stationId: 1,
          trackTitle: "Electronic Dreams",
          artist: "DJ Pulse",
          endTime: new Date(Date.now() + 3 * 60 * 1000) // 3 minutes from now
        },
        {
          stationId: 2,
          trackTitle: "Smooth Sax Solo",
          artist: "Jazz Masters",
          endTime: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes from now
        },
        {
          stationId: 3,
          trackTitle: "Breaking News",
          artist: "News Anchor",
          endTime: null
        }
      ];
      
      await Promise.all(
        nowPlayingData.map(item => this.createNowPlaying(item))
      );
      
      console.log("Database seeding completed!");
    } catch (error) {
      console.error("Error seeding database:", error);
    }
  }
}

// Export a singleton instance of the database storage implementation
export const storage = new DatabaseStorage();