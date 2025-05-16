import { db } from "./db";
import * as schema from "@shared/schema";
import { hashPassword } from "./auth";

async function migrate() {
  console.log("Running database migrations...");
  
  try {
    // Verify database connection first - with a simple query
    console.log("Verifying database connection...");
    try {
      await db.execute('SELECT 1');
      console.log("Database connection successful");
    } catch (connError) {
      console.log("Waiting for database connection to be ready...");
      // Wait a bit and continue
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Create tables one by one to avoid rate limiting
    console.log("Creating tables...");
    
    // Create users table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'listener',
        display_name TEXT,
        profile_image TEXT,
        bio TEXT,
        employee_id TEXT,
        is_approved BOOLEAN,
        is_active BOOLEAN,
        account_status TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    
    // Continue with other tables
    await db.execute(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        icon TEXT NOT NULL,
        station_count INTEGER NOT NULL DEFAULT 0
      )
    `);
    
    await db.execute(`
      CREATE TABLE IF NOT EXISTS stations (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        stream_url TEXT NOT NULL,
        image_url TEXT NOT NULL,
        logo_url TEXT NOT NULL,
        is_live BOOLEAN NOT NULL DEFAULT TRUE,
        category_id INTEGER NOT NULL,
        tags TEXT NOT NULL,
        listener_count INTEGER NOT NULL DEFAULT 0,
        is_featured BOOLEAN NOT NULL DEFAULT FALSE,
        is_trending BOOLEAN NOT NULL DEFAULT FALSE
      )
    `);
    
    await db.execute(`
      CREATE TABLE IF NOT EXISTS playback_history (
        id SERIAL PRIMARY KEY,
        station_id INTEGER NOT NULL,
        timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
        user_id INTEGER
      )
    `);
    
    await db.execute(`
      CREATE TABLE IF NOT EXISTS now_playing (
        id SERIAL PRIMARY KEY,
        station_id INTEGER NOT NULL,
        track_title TEXT NOT NULL,
        artist TEXT NOT NULL,
        start_time TIMESTAMP NOT NULL DEFAULT NOW(),
        end_time TIMESTAMP
      )
    `);
    
    await db.execute(`
      CREATE TABLE IF NOT EXISTS favorites (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        station_id INTEGER NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    
    await db.execute(`
      CREATE TABLE IF NOT EXISTS live_streams (
        id SERIAL PRIMARY KEY,
        dj_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        cover_image TEXT,
        stream_key TEXT NOT NULL,
        is_live BOOLEAN NOT NULL DEFAULT FALSE,
        started_at TIMESTAMP,
        ended_at TIMESTAMP,
        category_id INTEGER NOT NULL,
        listener_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    console.log("Tables created successfully");

    // Check if we need to seed the database
    let needsSeeding = false;
    try {
      const result = await db.execute('SELECT COUNT(*) FROM users');
      needsSeeding = parseInt(result.rows[0].count) === 0;
    } catch (err) {
      // If there's an error in the query, assume we need to seed
      needsSeeding = true;
    }
    
    if (needsSeeding) {
      console.log("Seeding database with initial data...");
      
      // Create default category
      const categoryResult = await db.execute(`
        INSERT INTO categories (name, icon, station_count) 
        VALUES ('VJMZ Exclusive', 'radio', 1) 
        RETURNING id
      `);
      const categoryId = categoryResult.rows[0].id;
      
      // Create VJMZ station
      await db.execute({
        text: `
          INSERT INTO stations (
            name, description, stream_url, image_url, logo_url, 
            is_live, category_id, tags, listener_count, is_featured, is_trending
          ) 
          VALUES (
            'VJMZ-FM', 
            'Internet''s #1 JAM''N STATION', 
            'https://ice1.somafm.com/defcon-128-mp3', 
            '/vjmz-banner.jpg', 
            '/vjmz-logo.jpg', 
            TRUE, 
            $1, 
            'hiphop,rnb,top40', 
            4850, 
            TRUE, 
            TRUE
          )`,
        values: [categoryId]
      });
      
      // Create admin user
      const adminPassword = await hashPassword("admin123");
      const adminResult = await db.execute({
        text: `
          INSERT INTO users (
            username, password, role, display_name, bio, 
            employee_id, is_approved, is_active, account_status
          ) 
          VALUES (
            'admin', 
            $1, 
            'admin', 
            'VJMZ Admin', 
            'Station administrator',
            'ADMIN01',
            TRUE,
            TRUE,
            'active'
          ) 
          RETURNING id
        `,
        values: [adminPassword]
      });
      
      // Create demo DJ user
      const djPassword = await hashPassword("password123");
      const djResult = await db.execute({
        text: `
          INSERT INTO users (
            username, password, role, display_name, bio,
            employee_id, is_approved, is_active, account_status
          ) 
          VALUES (
            'dj_smooth', 
            $1, 
            'dj', 
            'DJ Smooth', 
            'VJMZ resident DJ spinning the hottest tracks',
            'DJ00123',
            TRUE,
            TRUE,
            'active'
          ) 
          RETURNING id
        `,
        values: [djPassword]
      });
      const djId = djResult.rows[0].id;
      
      // Create demo listener user
      const listenerPassword = await hashPassword("listener123");
      await db.execute({
        text: `
          INSERT INTO users (
            username, password, role, display_name, bio
          ) 
          VALUES (
            'listener', 
            $1, 
            'listener', 
            'VJMZ Listener', 
            'Just here for the great music!'
          )
        `,
        values: [listenerPassword]
      });
      
      // Create a demo live stream
      const streamKey = `vjmz-${djId}-${Math.random().toString(36).substring(2, 15)}`;
      await db.execute({
        text: `
          INSERT INTO live_streams (
            dj_id, title, description, cover_image, stream_key, 
            is_live, category_id
          ) 
          VALUES (
            $1, 
            'Friday Night Party Mix', 
            'The hottest tracks to start your weekend right', 
            '/vjmz-banner.jpg', 
            $2, 
            FALSE, 
            $3
          )
        `,
        values: [djId, streamKey, categoryId]
      });
      
      console.log("Database seeded successfully");
      console.log("Demo accounts created:");
      console.log(" - DJ: username=dj_smooth, password=password123");
      console.log(" - Listener: username=listener, password=listener123");
      console.log(" - Admin: username=admin, password=admin123");
    } else {
      console.log("Database already seeded, skipping...");
    }
  } catch (error) {
    console.error("Error during migration:", error);
    // Don't exit the process, just log the error
    console.log("Migration error, continuing with application startup");
  }
}

// Run migration
migrate();

export { migrate };