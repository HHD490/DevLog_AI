import { Router } from 'express';
import { generateSkillTree, getSkillTree, getSkillTreeStats } from '../services/skillTreeService';

const router = Router();

// GET /api/skills - Get current skill tree
router.get('/', async (req, res) => {
    try {
        const skills = await getSkillTree();
        res.json(skills);
    } catch (error) {
        console.error('Error fetching skill tree:', error);
        res.status(500).json({ error: 'Failed to fetch skill tree' });
    }
});

// GET /api/skills/stats - Get skill tree statistics
router.get('/stats', async (req, res) => {
    try {
        const stats = await getSkillTreeStats();
        res.json(stats);
    } catch (error) {
        console.error('Error fetching skill tree stats:', error);
        res.status(500).json({ error: 'Failed to fetch skill tree stats' });
    }
});

// POST /api/skills/generate - Generate or update skill tree
router.post('/generate', async (req, res) => {
    try {
        const result = await generateSkillTree();
        res.json(result);
    } catch (error) {
        console.error('Error generating skill tree:', error);
        res.status(500).json({ error: 'Failed to generate skill tree' });
    }
});

export default router;
