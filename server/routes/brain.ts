/**
 * Brain Routes - Proxy to Python Agent Service
 * All agent requests are forwarded to the Python backend
 */

import { Router } from 'express';

const router = Router();
const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://localhost:5001';

/**
 * POST /api/brain/ask - Ask the Brain Agent
 * Proxies to Python backend's /agent/ask endpoint
 */
router.post('/ask', async (req, res) => {
    try {
        const { query, conversationHistory } = req.body;

        if (!query || typeof query !== 'string') {
            return res.status(400).json({ error: 'Query is required' });
        }

        // Forward to Python Agent
        const response = await fetch(`${PYTHON_BACKEND_URL}/agent/ask`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query,
                conversation_history: conversationHistory || []
            })
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('[Brain] Python agent error:', error);
            return res.status(response.status).json({ error: 'Agent request failed' });
        }

        const data = await response.json();
        res.json({
            answer: data.answer,
            retrievedLogs: data.retrieved_logs,
            intent: data.intent
        });
    } catch (error) {
        console.error('[Brain] Error asking brain:', error);
        res.status(500).json({ error: 'Failed to process query' });
    }
});

/**
 * POST /api/brain/ask/stream - Ask the Brain with streaming
 * Returns SSE stream
 */
router.post('/ask/stream', async (req, res) => {
    try {
        const { query, conversationHistory } = req.body;

        if (!query || typeof query !== 'string') {
            return res.status(400).json({ error: 'Query is required' });
        }

        // Set SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // Forward to Python Agent streaming endpoint
        const response = await fetch(`${PYTHON_BACKEND_URL}/agent/ask/stream`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query,
                conversation_history: conversationHistory || []
            })
        });

        if (!response.ok || !response.body) {
            res.write(`data: ${JSON.stringify({ error: 'Stream failed' })}\n\n`);
            res.end();
            return;
        }

        // Pipe the response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(decoder.decode(value, { stream: true }));
        }

        res.end();
    } catch (error) {
        console.error('[Brain] Stream error:', error);
        res.write(`data: ${JSON.stringify({ error: 'Stream failed' })}\n\n`);
        res.end();
    }
});

export default router;
