import sqlite3 from 'sqlite3';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let dbType = process.env.DB_TYPE || 'sqlite';
let mysqlConnection = null;
let sqliteDb = null;

// Initialize Database connection
async function initDatabase() {
  if (dbType === 'mysql' && process.env.DB_HOST) {
    try {
      mysqlConnection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306
      });
      console.log('⚡ [Database] Connected successfully to MySQL Database.');
    } catch (error) {
      console.warn('⚠️ [Database] Failed to connect to MySQL:', error.message);
      console.info('🔄 [Database] Falling back to SQLite...');
      dbType = 'sqlite';
    }
  }

  if (dbType === 'sqlite') {
    const dbPath = path.join(__dirname, 'database.sqlite');
    sqliteDb = new sqlite3.Database(dbPath);
    console.log(`⚡ [Database] Connected successfully to SQLite Database at ${dbPath}`);
  }

  // Create tables and seed data
  await setupSchema();
}

// Unified Promise-based DB Access
export async function query(sql, params = []) {
  if (dbType === 'mysql') {
    const [rows] = await mysqlConnection.execute(sql, params);
    return rows;
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

export async function get(sql, params = []) {
  if (dbType === 'mysql') {
    const [rows] = await mysqlConnection.execute(sql, params);
    return rows[0] || null;
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row || null);
      });
    });
  }
}

export async function run(sql, params = []) {
  if (dbType === 'mysql') {
    const [result] = await mysqlConnection.execute(sql, params);
    return { insertId: result.insertId, changes: result.affectedRows };
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ insertId: this.lastID, changes: this.changes });
      });
    });
  }
}

// Setup Schema & Seed Initial Data
async function setupSchema() {
  const isSQLite = dbType === 'sqlite';

  // 1. Create Users Table
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id ${isSQLite ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'INT AUTO_INCREMENT PRIMARY KEY'},
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'user',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 2. Create Events Table
  await run(`
    CREATE TABLE IF NOT EXISTS events (
      id ${isSQLite ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'INT AUTO_INCREMENT PRIMARY KEY'},
      title VARCHAR(255) NOT NULL,
      description TEXT,
      category VARCHAR(100) NOT NULL,
      event_date VARCHAR(100) NOT NULL,
      event_time VARCHAR(100) NOT NULL,
      venue VARCHAR(255) NOT NULL,
      price DECIMAL(10, 2) NOT NULL,
      image_url VARCHAR(500)
    )
  `);

  // 3. Create Bookings Table
  await run(`
    CREATE TABLE IF NOT EXISTS bookings (
      id ${isSQLite ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'INT AUTO_INCREMENT PRIMARY KEY'},
      user_id INT NOT NULL,
      event_id INT NOT NULL,
      total_price DECIMAL(10, 2) NOT NULL,
      seats_booked VARCHAR(255) NOT NULL,
      status VARCHAR(50) DEFAULT 'confirmed',
      booking_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 4. Create Seats Table
  await run(`
    CREATE TABLE IF NOT EXISTS seats (
      id ${isSQLite ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'INT AUTO_INCREMENT PRIMARY KEY'},
      event_id INT NOT NULL,
      seat_number VARCHAR(10) NOT NULL,
      status VARCHAR(50) DEFAULT 'available',
      user_id INT DEFAULT NULL,
      booking_id INT DEFAULT NULL
    )
  `);

  // Seed data if events table is empty
  const eventCount = await get('SELECT COUNT(*) as count FROM events');
  if (eventCount.count === 0) {
    console.log('🌱 [Database] Seeding initial events and seats...');

    const eventsSeed = [
      {
        title: 'Neon Odyssey: Cyberpunk Concert',
        description: 'Experience an ultra-sensory live performance from the future. Synthwave beats meet holographic laser art.',
        category: 'Concert',
        event_date: '2026-06-15',
        event_time: '20:00',
        venue: 'Aetheria Amphitheater, Sector 7',
        price: 85.00,
        image_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80'
      },
      {
        title: 'A.I. Uprising: The Cyber Thriller Movie',
        description: 'The blockbuster movie of the year. A gripping story of an autonomous intelligence fighting for digital liberation.',
        category: 'Movie',
        event_date: '2026-05-30',
        event_time: '19:30',
        venue: 'Omniplex IMAX Theatre',
        price: 18.50,
        image_url: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&q=80'
      },
      {
        title: 'Global Apex: Cyber Athletics Finals',
        description: 'The ultimate showdown of high-agility bio-engineered sports. Witness peak human performance in glowing arenas.',
        category: 'Sports',
        event_date: '2026-07-04',
        event_time: '15:00',
        venue: 'Apex Neo-Dome',
        price: 120.00,
        image_url: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800&q=80'
      },
      {
        title: 'Quantum Dreams: Holographic Theater',
        description: 'A theatrical production blending traditional stagecraft with live neuro-holograms. A stunning poetic experience.',
        category: 'Theater',
        event_date: '2026-06-08',
        event_time: '18:00',
        venue: 'Prism Opera House',
        price: 65.00,
        image_url: 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?w=800&q=80'
      }
    ];

    for (const event of eventsSeed) {
      const res = await run(`
        INSERT INTO events (title, description, category, event_date, event_time, venue, price, image_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [event.title, event.description, event.category, event.event_date, event.event_time, event.venue, event.price, event.image_url]);

      const eventId = res.insertId;

      // Seed 24 seats for each event
      const rows = ['A', 'B', 'C', 'D'];
      for (const row of rows) {
        for (let i = 1; i <= 6; i++) {
          const seatNum = `${row}${i}`;
          const randomStatus = Math.random() < 0.25 ? 'booked' : 'available';
          const userId = randomStatus === 'booked' ? 1 : null;
          await run(`
            INSERT INTO seats (event_id, seat_number, status, user_id)
            VALUES (?, ?, ?, ?)
          `, [eventId, seatNum, randomStatus, userId]);
        }
      }
    }
    console.log('🌱 [Database] Seeding completed.');
  }
}

export { initDatabase, dbType };
