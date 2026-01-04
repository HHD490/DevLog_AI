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
 * Get graph nodes and edges for visualization
 * Query params:
 *   - limit: max nodes (default 10000)
 *   - minSimilarity: threshold for edges (default 0)
 */
router.get('/data', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit as string) || 10000;
        const minSimilarity = parseFloat(req.query.minSimilarity as string) || 0;

        // Get nodes and embeddings
        const { nodes, embeddings } = await getGraphData(limit);

        if (nodes.length === 0) {
            return res.json({ nodes: [], edges: [] });
        }

        // Compute similarity matrix
        const embeddingVectors = embeddings.map(e => e.embedding);
        const matrix = await computeSimilarityMatrix(embeddingVectors);

        if (!matrix) {
            // If similarity computation fails, return nodes only
            return res.json({ nodes, edges: [] });
        }

        // Build edges from similarity matrix
        const edges: { source: string; target: string; weight: number }[] = [];
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const similarity = matrix[i][j];
                if (similarity >= minSimilarity) {
                    edges.push({
                        source: nodes[i].id,
                        target: nodes[j].id,
                        weight: similarity
                    });
                }
            }
        }

        // Sort edges by weight descending
        edges.sort((a, b) => b.weight - a.weight);

        res.json({ nodes, edges });
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
