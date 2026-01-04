/**
 * Graph API Routes
 * Endpoints for Knowledge Graph visualization
 */

import { Router } from 'express';
import { getGraphData, computeSimilarityMatrix, checkEmbeddingServiceHealth, processUnprocessedLogs } from '../services/embeddingService.js';

const router = Router();

/**
 * GET /api/graph/health
 * Check embedding service health
 */
router.get('/health', async (req, res) => {
    try {
        const health = await checkEmbeddingServiceHealth();
        if (health) {
            res.json({ status: 'ok', embedding_service: health });
        } else {
            res.status(503).json({ status: 'error', message: 'Embedding service unavailable' });
        }
    } catch (error) {
        console.error('[Graph] Health check error:', error);
        res.status(500).json({ error: 'Failed to check health' });
    }
});

/**
 * GET /api/graph/data
 * Get graph nodes and embeddings for visualization
 * Similarity computation is done on frontend
 * Query params:
 *   - limit: max nodes (default 10000)
 */
router.get('/data', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit as string) || 10000;

        // Get nodes and embeddings
        const { nodes, embeddings } = await getGraphData(limit);

        if (nodes.length === 0) {
            return res.json({ nodes: [], embeddings: [] });
        }

        // Return nodes with their embeddings for frontend similarity computation
        const nodeEmbeddings = nodes.map((node, i) => ({
            id: node.id,
            embedding: embeddings[i]?.embedding || null
        }));

        res.json({ nodes, embeddings: nodeEmbeddings });
    } catch (error) {
        console.error('[Graph] Data fetch error:', error);
        res.status(500).json({ error: 'Failed to get graph data' });
    }
});

/**
 * POST /api/graph/process
 * Manually trigger processing of unprocessed logs
 */
router.post('/process', async (req, res) => {
    try {
        const processed = await processUnprocessedLogs();
        res.json({ processed, message: `Processed ${processed} logs` });
    } catch (error) {
        console.error('[Graph] Process error:', error);
        res.status(500).json({ error: 'Failed to process logs' });
    }
});

/**
 * GET /api/graph/stats
 * Get statistics about the knowledge graph
 */
router.get('/stats', async (req, res) => {
    try {
        const { nodes } = await getGraphData(100000);

        // Count by source
        const sourceCount: Record<string, number> = {};
        nodes.forEach(n => {
            sourceCount[n.source] = (sourceCount[n.source] || 0) + 1;
        });

        // Count by tags
        const tagCount: Record<string, number> = {};
        nodes.forEach(n => {
            n.tags.forEach((t: any) => {
                tagCount[t.name] = (tagCount[t.name] || 0) + 1;
            });
        });

        // Sort tags by count
        const topTags = Object.entries(tagCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)
            .map(([name, count]) => ({ name, count }));

        res.json({
            totalNodes: nodes.length,
            bySource: sourceCount,
            topTags
        });
    } catch (error) {
        console.error('[Graph] Stats error:', error);
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

export default router;
