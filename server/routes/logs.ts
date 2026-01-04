import { Router } from 'express';
import { db, schema } from '../db';
import { eq, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { processEntryWithLocalFirst } from '../services/tagService';
import { processLogEmbedding } from '../services/embeddingService';

const router = Router();

// GET /api/logs - Get all logs
router.get('/', async (req, res) => {
    try {
        const logs = await db.select()
            .from(schema.logs)
            .orderBy(desc(schema.logs.timestamp));

        // Transform to frontend format
        const transformed = logs.map(log => ({
            id: log.id,
            content: log.content,
            timestamp: log.timestamp,
            tags: JSON.parse(log.tagsJson || '[]'),
            source: log.source,
            summary: log.summary,
            needsAiProcessing: log.needsAiProcessing
        }));

        res.json(transformed);
    } catch (error) {
        console.error('Error fetching logs:', error);
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});

// POST /api/logs - Create a new log entry
router.post('/', async (req, res) => {
    try {
        const { content, source = 'manual' } = req.body;

        if (!content || typeof content !== 'string') {
            return res.status(400).json({ error: 'Content is required' });
        }

        // Process with local-first approach
        const { tags, summary, needsAiProcessing } = await processEntryWithLocalFirst(content);

        const newLog = {
            id: uuidv4(),
            content,
            timestamp: Date.now(),
            tagsJson: JSON.stringify(tags),
            source,
            summary,
            needsAiProcessing,
            processedForSkillTree: false
        };

        await db.insert(schema.logs).values(newLog);

        // Trigger embedding computation asynchronously (don't wait)
        processLogEmbedding(newLog.id, content).catch(err => {
            console.error('[Logs] Background embedding failed:', err);
        });

        // Return in frontend format
        res.status(201).json({
            id: newLog.id,
            content: newLog.content,
            timestamp: newLog.timestamp,
            tags,
            source: newLog.source,
            summary: newLog.summary,
            needsAiProcessing: newLog.needsAiProcessing
        });
    } catch (error) {
        console.error('Error creating log:', error);
        res.status(500).json({ error: 'Failed to create log' });
    }
});

// POST /api/logs/batch - Create multiple logs (for GitHub sync)
router.post('/batch', async (req, res) => {
    try {
        const { entries } = req.body;

        if (!Array.isArray(entries)) {
            return res.status(400).json({ error: 'Entries array is required' });
        }

        const results = [];

        for (const entry of entries) {
            const { content, source = 'github', timestamp } = entry;

            const { tags, summary, needsAiProcessing } = await processEntryWithLocalFirst(content);

            const newLog = {
                id: uuidv4(),
                content,
                timestamp: timestamp || Date.now(),
                tagsJson: JSON.stringify(tags),
                source,
                summary,
                needsAiProcessing,
                processedForSkillTree: false
            };

            await db.insert(schema.logs).values(newLog);

            results.push({
                id: newLog.id,
                content: newLog.content,
                timestamp: newLog.timestamp,
                tags,
                source: newLog.source,
                summary: newLog.summary
            });
        }

        res.status(201).json(results);
    } catch (error) {
        console.error('Error batch creating logs:', error);
        res.status(500).json({ error: 'Failed to batch create logs' });
    }
});

// DELETE /api/logs/:id - Delete a log
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        await db.delete(schema.logs).where(eq(schema.logs.id, id));

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting log:', error);
        res.status(500).json({ error: 'Failed to delete log' });
    }
});

// POST /api/logs/migrate - Migrate data from localStorage
router.post('/migrate', async (req, res) => {
    try {
        const { logs } = req.body;

        if (!Array.isArray(logs)) {
            return res.status(400).json({ error: 'Logs array is required' });
        }

        let migrated = 0;

        for (const log of logs) {
            // Check if already exists
            const existing = await db.select()
                .from(schema.logs)
                .where(eq(schema.logs.id, log.id));

            if (existing.length === 0) {
                await db.insert(schema.logs).values({
                    id: log.id,
                    content: log.content,
                    timestamp: log.timestamp,
                    tagsJson: JSON.stringify(log.tags || []),
                    source: log.source || 'manual',
                    summary: log.summary,
                    needsAiProcessing: false,
                    processedForSkillTree: false
                });
                migrated++;
            }
        }

        res.json({ success: true, migrated });
    } catch (error) {
        console.error('Error migrating logs:', error);
        res.status(500).json({ error: 'Failed to migrate logs' });
    }
});

export default router;
