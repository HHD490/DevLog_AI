/**
 * Blog Routes - Generates blog posts from logs
 * AI calls proxied to Python backend
 */

import { Router } from 'express';
import { db, schema } from '../db';
import { desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://localhost:5001';

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

        // Proxy to Python backend for blog generation
        const response = await fetch(`${PYTHON_BACKEND_URL}/ai/blog`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                logs: rangeLogs.map(l => ({ timestamp: l.timestamp, content: l.content })),
                period_name: periodName || `${startDate} to ${endDate}`
            })
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('[Blogs] Python backend error:', error);
            return res.status(500).json({ error: 'Failed to generate blog' });
        }

        const result = await response.json();

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
