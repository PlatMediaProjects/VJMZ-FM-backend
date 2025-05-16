import { db } from './db';
import { sql } from 'drizzle-orm';

async function runMigration() {
  try {
    console.log('Starting manual migration...');
    
    // Add new columns to users table
    await db.execute(sql`
      ALTER TABLE IF EXISTS users 
      ADD COLUMN IF NOT EXISTS employee_id TEXT UNIQUE,
      ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS account_status TEXT DEFAULT 'active'
    `);
    console.log('Added new columns to users table');
    
    // Create DJ time slots table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS dj_time_slots (
        id SERIAL PRIMARY KEY,
        dj_id INTEGER NOT NULL REFERENCES users(id),
        day_of_week INTEGER NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        is_recurring BOOLEAN DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log('Created dj_time_slots table');

    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

runMigration()
  .then(() => {
    console.log('Manual migration script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Manual migration script failed:', error);
    process.exit(1);
  });