import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

// Import routes
import logsRoutes from './routes/logs';
import summariesRoutes from './routes/summaries';
import skillTreeRoutes from './routes/skillTree';
import blogsRoutes from './routes/blogs';
import brainRoutes from './routes/brain';
import processingRoutes from './routes/processing';
import githubRoutes from './routes/github';
import conversationsRoutes from './routes/conversations';
import graphRoutes from './routes/graph';

// Import scheduler
import { initScheduler } from './services/schedulerService';

// Import AI provider for status
import { getCurrentProviderName } from './services/aiProvider';

// Initialize database (this creates tables if they don't exist)
import { db, schema } from './db';
import { sql } from 'drizzle-orm';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// API Routes
app.use('/api/logs', logsRoutes);
app.use('/api/summaries', summariesRoutes);
app.use('/api/skills', skillTreeRoutes);
app.use('/api/blogs', blogsRoutes);
app.use('/api/brain', brainRoutes);
app.use('/api/processing', processingRoutes);
app.use('/api/github', githubRoutes);
app.use('/api/conversations', conversationsRoutes);
app.use('/api/graph', graphRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    aiProvider: getCurrentProviderName()
  });
});

// Initialize database tables
async function initDatabase() {
  console.log('[DB] Initializing database...');

  try {
    // Create tables using raw SQL (since we're not using migrations for simplicity)
    const sqliteDb = (db as any).$client;

    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS logs (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        tags_json TEXT DEFAULT '[]',
        source TEXT NOT NULL DEFAULT 'manual',
        summary TEXT,
        needs_ai_processing INTEGER DEFAULT 0,
        processed_for_skill_tree INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch())
      );
      
      CREATE TABLE IF NOT EXISTS daily_summaries (
        date TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        key_achievements_json TEXT DEFAULT '[]',
        tech_stack_json TEXT DEFAULT '[]',
        auto_generated INTEGER DEFAULT 0,
        processed_for_skill_tree INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (unixepoch())
      );
      
      CREATE TABLE IF NOT EXISTS skill_tree (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        name TEXT NOT NULL,
        maturity_level INTEGER NOT NULL DEFAULT 1,
        work_examples_json TEXT DEFAULT '[]',
        related_logs_json TEXT DEFAULT '[]',
        first_seen INTEGER DEFAULT (unixepoch()),
        last_updated INTEGER DEFAULT (unixepoch())
      );
      
      CREATE TABLE IF NOT EXISTS processing_queue (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        reference_id TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at INTEGER DEFAULT (unixepoch()),
        processed_at INTEGER
      );
      
      CREATE TABLE IF NOT EXISTS blog_posts (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        date_range_start INTEGER NOT NULL,
        date_range_end INTEGER NOT NULL,
        created_at INTEGER DEFAULT (unixepoch())
      );
      
      CREATE TABLE IF NOT EXISTS app_state (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at INTEGER DEFAULT (unixepoch())
      );
      
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL DEFAULT 'New Chat',
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch()),
        is_archived INTEGER DEFAULT 0
      );
      
      CREATE TABLE IF NOT EXISTS conversation_messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp INTEGER DEFAULT (unixepoch()),
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );
      
      CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_logs_needs_processing ON logs(needs_ai_processing);
      CREATE INDEX IF NOT EXISTS idx_logs_skill_tree ON logs(processed_for_skill_tree);
      CREATE INDEX IF NOT EXISTS idx_conv_messages_conv_id ON conversation_messages(conversation_id);
    `);

    console.log('[DB] Database initialized successfully');
  } catch (error) {
    console.error('[DB] Failed to initialize database:', error);
    throw error;
  }
}

// Start server
async function start() {
  try {
    // Initialize database
    await initDatabase();

    // Initialize scheduler
    initScheduler();

    // Start listening
    app.listen(PORT, () => {
      console.log(`\n🚀 DevLog AI Server running on http://localhost:${PORT}`);
      console.log(`   API endpoints: http://localhost:${PORT}/api/*`);
      console.log(`   Health check: http://localhost:${PORT}/api/health\n`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
