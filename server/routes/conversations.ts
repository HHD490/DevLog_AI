import { Router } from 'express';
import { db, schema } from '../db';
import { eq, desc, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// GET /api/conversations - Get all conversations
router.get('/', async (req, res) => {
    try {
        const { filter } = req.query; // 'all' | 'archived' | 'active'

        let whereClause;
        if (filter === 'archived') {
            whereClause = eq(schema.conversations.isArchived, true);
        } else if (filter === 'active' || !filter) {
            whereClause = eq(schema.conversations.isArchived, false);
        }
        // 'all' = no filter

        const conversations = await db.select()
            .from(schema.conversations)
            .where(whereClause)
            .orderBy(desc(schema.conversations.updatedAt));

        res.json(conversations);
    } catch (error: any) {
        console.error('Error fetching conversations:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/conversations - Create new conversation
router.post('/', async (req, res) => {
    try {
        const id = uuidv4();
        const now = new Date();

        await db.insert(schema.conversations).values({
            id,
            title: 'New Chat',
            createdAt: now,
            updatedAt: now,
            isArchived: false
        });

        const conversation = await db.select()
            .from(schema.conversations)
            .where(eq(schema.conversations.id, id));

        res.json(conversation[0]);
    } catch (error: any) {
        console.error('Error creating conversation:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/conversations/:id - Get conversation with messages
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const conversation = await db.select()
            .from(schema.conversations)
            .where(eq(schema.conversations.id, id));

        if (!conversation[0]) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        const messages = await db.select()
            .from(schema.conversationMessages)
            .where(eq(schema.conversationMessages.conversationId, id))
            .orderBy(schema.conversationMessages.timestamp);

        res.json({
            ...conversation[0],
            messages
        });
    } catch (error: any) {
        console.error('Error fetching conversation:', error);
        res.status(500).json({ error: error.message });
    }
});

// PATCH /api/conversations/:id - Update conversation (title, archive)
router.patch('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { title, isArchived } = req.body;

        const updates: any = { updatedAt: new Date() };
        if (title !== undefined) updates.title = title;
        if (isArchived !== undefined) updates.isArchived = isArchived;

        await db.update(schema.conversations)
            .set(updates)
            .where(eq(schema.conversations.id, id));

        const conversation = await db.select()
            .from(schema.conversations)
            .where(eq(schema.conversations.id, id));

        res.json(conversation[0]);
    } catch (error: any) {
        console.error('Error updating conversation:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/conversations/:id - Delete conversation
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Messages will be cascade deleted due to foreign key
        await db.delete(schema.conversations)
            .where(eq(schema.conversations.id, id));

        res.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting conversation:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/conversations/:id/messages - Send message and get AI response
router.post('/:id/messages', async (req, res) => {
    try {
        const { id } = req.params;
        const { content } = req.body;

        if (!content?.trim()) {
            return res.status(400).json({ error: 'Message content is required' });
        }

        // Save user message
        const userMessageId = uuidv4();
        const now = new Date();

        await db.insert(schema.conversationMessages).values({
            id: userMessageId,
            conversationId: id,
            role: 'user',
            content: content.trim(),
            timestamp: now
        });

        // Get recent messages for context (last 5 rounds = 10 messages)
        const recentMessages = await db.select()
            .from(schema.conversationMessages)
            .where(eq(schema.conversationMessages.conversationId, id))
            .orderBy(desc(schema.conversationMessages.timestamp))
            .limit(10);

        // Reverse to get chronological order
        const contextMessages = recentMessages.reverse();

        // Proxy to Python Agent for AI response
        const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://localhost:5001';

        const agentResponse = await fetch(`${PYTHON_BACKEND_URL}/agent/ask`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: content.trim(),
                conversation_history: contextMessages.map(m => ({
                    role: m.role,
                    content: m.content
                }))
            })
        });

        let aiResponse = "I couldn't generate a response.";
        if (agentResponse.ok) {
            const data = await agentResponse.json();
            aiResponse = data.answer || aiResponse;
        } else {
            console.error('[Conversations] Agent request failed:', await agentResponse.text());
        }

        // Save AI response
        const aiMessageId = uuidv4();
        await db.insert(schema.conversationMessages).values({
            id: aiMessageId,
            conversationId: id,
            role: 'assistant',
            content: aiResponse,
            timestamp: new Date()
        });

        // Update conversation timestamp
        await db.update(schema.conversations)
            .set({ updatedAt: new Date() })
            .where(eq(schema.conversations.id, id));

        // Auto-generate title if this is the first message
        const messageCount = await db.select()
            .from(schema.conversationMessages)
            .where(eq(schema.conversationMessages.conversationId, id));

        if (messageCount.length === 2) { // First user + first AI response
            try {
                const titleResponse = await fetch(`${PYTHON_BACKEND_URL}/ai/title`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: content.trim() })
                });
                if (titleResponse.ok) {
                    const { title } = await titleResponse.json();
                    await db.update(schema.conversations)
                        .set({ title })
                        .where(eq(schema.conversations.id, id));
                }
            } catch (e) {
                console.error('Failed to generate title:', e);
            }
        }

        res.json({
            userMessage: {
                id: userMessageId,
                role: 'user',
                content: content.trim(),
                timestamp: now
            },
            aiMessage: {
                id: aiMessageId,
                role: 'assistant',
                content: aiResponse,
                timestamp: new Date()
            }
        });
    } catch (error: any) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
