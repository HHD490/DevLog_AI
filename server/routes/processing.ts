import { Router } from 'express';
import { batchProcessPendingEntries, getProcessingStats } from '../services/tagService';
import { triggerDailyRecap } from '../services/schedulerService';

const router = Router();

// GET /api/processing/stats - Get processing statistics
router.get('/stats', async (req, res) => {
    try {
        const stats = await getProcessingStats();
        res.json(stats);
    } catch (error) {
        console.error('Error fetching processing stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// POST /api/processing/batch - Manually trigger batch processing
router.post('/batch', async (req, res) => {
    try {
        const result = await batchProcessPendingEntries();
        res.json(result);
    } catch (error) {
        console.error('Error running batch processing:', error);
        res.status(500).json({ error: 'Failed to run batch processing' });
    }
});

// POST /api/processing/daily-recap - Manually trigger daily recap
router.post('/daily-recap', async (req, res) => {
    try {
        const { date } = req.body;
        const result = await triggerDailyRecap(date);
        res.json(result);
    } catch (error) {
        console.error('Error triggering daily recap:', error);
        res.status(500).json({ error: 'Failed to trigger daily recap' });
    }
});

export default router;
