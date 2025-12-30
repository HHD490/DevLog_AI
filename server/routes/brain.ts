import { Router } from 'express';
import { db, schema } from '../db';
import { geminiService } from '../services/geminiService';
import { Tag } from '../services/types';

const router = Router();

// POST /api/brain/ask - Ask the Brain (RAG query)
router.post('/ask', async (req, res) => {
    try {
        const { query } = req.body;

        if (!query || typeof query !== 'string') {
            return res.status(400).json({ error: 'Query is required' });
        }

        // Get all logs for context
        const logs = await db.select().from(schema.logs);

        const answer = await geminiService.askBrain(
            query,
            logs.map(l => ({
                timestamp: l.timestamp,
                content: l.content,
                tags: JSON.parse(l.tagsJson || '[]') as Tag[]
            }))
        );

        res.json({ answer });
    } catch (error) {
        console.error('Error asking brain:', error);
        res.status(500).json({ error: 'Failed to process query' });
    }
});

export default router;
