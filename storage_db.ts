import { IStorage } from "./storage";
import { db } from "./db";
import { 
  users, categories, stations, playbackHistory, nowPlaying, favorites, liveStreams,
  type User, type InsertUser, type Category, type InsertCategory,
  type Station, type InsertStation, type PlaybackHistory, type InsertPlaybackHistory,
  type NowPlaying, type InsertNowPlaying, type Favorite, type InsertFavorite,
  type LiveStream, type InsertLiveStream
} from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { randomBytes } from "crypto";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export class DatabaseStorage implements IStorage {
  public sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true
    });
  }

  // User methods
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

  // Category methods
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

  // Station methods
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
    return db.select().from(stations).where(eq(stations.isFeatured, true));
  }

  async getTrendingStations(): Promise<Station[]> {
    return db.select().from(stations).where(eq(stations.isTrending, true));
  }

  async createStation(insertStation: InsertStation): Promise<Station> {
    const [station] = await db.insert(stations).values(insertStation).returning();
    return station;
  }

  // Playback history methods
  async getPlaybackHistory(limit: number = 10): Promise<(PlaybackHistory & { station: Station })[]> {
    const history = await db
      .select({
        history: playbackHistory,
        station: stations
      })
      .from(playbackHistory)
      .leftJoin(stations, eq(playbackHistory.stationId, stations.id))
      .orderBy(desc(playbackHistory.timestamp))
      .limit(limit);

    return history
      .filter(({ station }) => station !== null)
      .map(({ history, station }) => ({
        ...history,
        station: station!
      }));
  }

  async createPlaybackHistory(insertHistory: InsertPlaybackHistory): Promise<PlaybackHistory> {
    const [history] = await db.insert(playbackHistory).values(insertHistory).returning();
    return history;
  }

  // Now playing methods
  async getNowPlaying(stationId: number): Promise<NowPlaying | undefined> {
    const [current] = await db
      .select()
      .from(nowPlaying)
      .where(and(
        eq(nowPlaying.stationId, stationId),
        sql`${nowPlaying.endTime} IS NULL`
      ));
    return current;
  }

  async createNowPlaying(insertNowPlaying: InsertNowPlaying): Promise<NowPlaying> {
    // First, end any current tracks for this station
    await db
      .update(nowPlaying)
      .set({ endTime: new Date() })
      .where(and(
        eq(nowPlaying.stationId, insertNowPlaying.stationId),
        sql`${nowPlaying.endTime} IS NULL`
      ));

    // Then create the new now playing entry
    const [newNowPlaying] = await db.insert(nowPlaying).values(insertNowPlaying).returning();
    return newNowPlaying;
  }

  // Favorites methods
  async getFavorites(userId: number): Promise<(Favorite & { station: Station })[]> {
    const userFavorites = await db
      .select({
        favorite: favorites,
        station: stations
      })
      .from(favorites)
      .leftJoin(stations, eq(favorites.stationId, stations.id))
      .where(eq(favorites.userId, userId))
      .orderBy(desc(favorites.createdAt));

    return userFavorites
      .filter(({ station }) => station !== null)
      .map(({ favorite, station }) => ({
        ...favorite,
        station: station!
      }));
  }

  async createFavorite(insertFavorite: InsertFavorite): Promise<Favorite> {
    // Check if already exists
    const [existing] = await db
      .select()
      .from(favorites)
      .where(and(
        eq(favorites.userId, insertFavorite.userId),
        eq(favorites.stationId, insertFavorite.stationId)
      ));

    if (existing) {
      return existing;
    }

    const [favorite] = await db.insert(favorites).values(insertFavorite).returning();
    return favorite;
  }

  async removeFavorite(userId: number, stationId: number): Promise<void> {
    await db
      .delete(favorites)
      .where(and(
        eq(favorites.userId, userId),
        eq(favorites.stationId, stationId)
      ));
  }

  async isFavorite(userId: number, stationId: number): Promise<boolean> {
    const [favorite] = await db
      .select()
      .from(favorites)
      .where(and(
        eq(favorites.userId, userId),
        eq(favorites.stationId, stationId)
      ));
    return !!favorite;
  }

  // Live Stream methods
  async getLiveStreams(): Promise<(LiveStream & { dj: User })[]> {
    const streams = await db
      .select({
        stream: liveStreams,
        dj: users
      })
      .from(liveStreams)
      .leftJoin(users, eq(liveStreams.djId, users.id))
      .orderBy(desc(liveStreams.createdAt));

    return streams
      .filter(({ dj }) => dj !== null)
      .map(({ stream, dj }) => ({
        ...stream,
        dj: dj!
      }));
  }

  async getLiveStreamById(id: number): Promise<(LiveStream & { dj: User }) | undefined> {
    const [stream] = await db
      .select({
        stream: liveStreams,
        dj: users
      })
      .from(liveStreams)
      .leftJoin(users, eq(liveStreams.djId, users.id))
      .where(eq(liveStreams.id, id));

    if (!stream || !stream.dj) return undefined;

    return {
      ...stream.stream,
      dj: stream.dj
    };
  }

  async getLiveStreamsByDj(djId: number): Promise<LiveStream[]> {
    return db
      .select()
      .from(liveStreams)
      .where(eq(liveStreams.djId, djId))
      .orderBy(desc(liveStreams.createdAt));
  }

  async createLiveStream(insertLiveStream: InsertLiveStream): Promise<LiveStream> {
    // Generate stream key if not provided
    if (!insertLiveStream.streamKey) {
      insertLiveStream.streamKey = await this.generateStreamKey(insertLiveStream.djId);
    }

    const [liveStream] = await db.insert(liveStreams).values(insertLiveStream).returning();
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
    return this.updateLiveStream(id, {
      isLive: true,
      startedAt: new Date()
    });
  }

  async endLiveStream(id: number): Promise<LiveStream> {
    return this.updateLiveStream(id, {
      isLive: false,
      endedAt: new Date()
    });
  }

  async deleteLiveStream(id: number): Promise<void> {
    await db.delete(liveStreams).where(eq(liveStreams.id, id));
  }

  async generateStreamKey(djId: number): Promise<string> {
    // Generate a unique stream key for the DJ
    const key = `vjmz-${djId}-${randomBytes(16).toString('hex')}`;
    return key;
  }

  async validateStreamKey(streamKey: string): Promise<boolean> {
    const [stream] = await db
      .select()
      .from(liveStreams)
      .where(eq(liveStreams.streamKey, streamKey));
    return !!stream;
  }
}