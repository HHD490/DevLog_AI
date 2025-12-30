import { Router } from 'express';
import { db, schema } from '../db';
import { desc } from 'drizzle-orm';
import { geminiService } from '../services/geminiService';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// GET /api/blogs - Get all blog posts
router.get('/', async (req, res) => {
    try {
        const blogs = await db.select()
            .from(schema.blogPosts)
            .orderBy(desc(schema.blogPosts.createdAt));

        const transformed = blogs.map(blog => ({
            id: blog.id,
            title: blog.title,
            content: blog.content,
            dateRange: {
                start: blog.dateRangeStart,
                end: blog.dateRangeEnd
            },
            createdAt: blog.createdAt?.getTime() || Date.now()
        }));

        res.json(transformed);
    } catch (error) {
        console.error('Error fetching blogs:', error);
        res.status(500).json({ error: 'Failed to fetch blogs' });
    }
});

// POST /api/blogs/generate - Generate a blog post
router.post('/generate', async (req, res) => {
    try {
        const { startDate, endDate, periodName } = req.body;

        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'startDate and endDate are required' });
        }

        const start = new Date(startDate).getTime();
        const end = new Date(endDate).getTime();

        // Get logs in range
        const allLogs = await db.select().from(schema.logs);
        const rangeLogs = allLogs.filter(log =>
            log.timestamp >= start && log.timestamp <= end
        );

        if (rangeLogs.length === 0) {
            return res.status(404).json({ error: 'No logs found in this date range' });
        }

        // Generate blog
        const result = await geminiService.generateBlog(
            rangeLogs.map(l => ({ timestamp: l.timestamp, content: l.content })),
            periodName || `${startDate} to ${endDate}`
        );

        // Save blog
        const newBlog = {
            id: uuidv4(),
            title: result.title,
            content: result.content,
            dateRangeStart: start,
            dateRangeEnd: end,
            createdAt: new Date()
        };

        await db.insert(schema.blogPosts).values(newBlog);

        res.status(201).json({
            id: newBlog.id,
            title: newBlog.title,
            content: newBlog.content,
            dateRange: {
                start: newBlog.dateRangeStart,
                end: newBlog.dateRangeEnd
            },
            createdAt: newBlog.createdAt.getTime()
        });
    } catch (error) {
        console.error('Error generating blog:', error);
        res.status(500).json({ error: 'Failed to generate blog' });
    }
});

export default router;
