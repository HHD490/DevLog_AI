/**
 * Embedding Service
 * Interfaces with Python FastAPI embedding service for BGE-M3 embeddings.
 */

import { db } from '../db/index.js';
import { logEmbeddings, logs } from '../db/schema.js';
import { eq, isNull, sql } from 'drizzle-orm';

const EMBEDDING_API_URL = process.env.EMBEDDING_API_URL || 'http://localhost:5001';

interface EmbedResponse {
    embedding: number[];
    chunks: number;
    tokens_estimated: number;
}

interface SimilarityMatrixResponse {
    matrix: number[][];
}

interface HealthResponse {
    status: string;
    model: string;
    model_loaded: boolean;
    max_tokens: number;
}

/**
 * Check if the embedding service is healthy
 */
export async function checkEmbeddingServiceHealth(): Promise<HealthResponse | null> {
    try {
        const response = await fetch(`${EMBEDDING_API_URL}/health`);
        if (response.ok) {
            return await response.json();
        }
        return null;
    } catch (error) {
        console.error('[Embedding] Service health check failed:', error);
        return null;
    }
}

/**
 * Compute embedding for a single text
 */
export async function computeEmbedding(text: string): Promise<{ embedding: number[]; chunks: number } | null> {
    try {
        const response = await fetch(`${EMBEDDING_API_URL}/embed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });

        if (!response.ok) {
            console.error('[Embedding] API error:', response.status);
            return null;
        }

        const data: EmbedResponse = await response.json();
        return { embedding: data.embedding, chunks: data.chunks };
    } catch (error) {
        console.error('[Embedding] Failed to compute embedding:', error);
        return null;
    }
}

/**
 * Compute embeddings for multiple texts
 */
export async function computeBatchEmbeddings(texts: string[]): Promise<number[][] | null> {
    try {
        const response = await fetch(`${EMBEDDING_API_URL}/embed/batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ texts })
        });

        if (!response.ok) {
            console.error('[Embedding] Batch API error:', response.status);
            return null;
        }

        const data = await response.json();
        return data.embeddings;
    } catch (error) {
        console.error('[Embedding] Failed to compute batch embeddings:', error);
        return null;
    }
}

/**
 * Compute similarity matrix for a list of embeddings
 */
export async function computeSimilarityMatrix(embeddings: number[][]): Promise<number[][] | null> {
    try {
        const response = await fetch(`${EMBEDDING_API_URL}/similarity/matrix`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeddings })
        });

        if (!response.ok) {
            console.error('[Embedding] Similarity matrix API error:', response.status);
            return null;
        }

        const data: SimilarityMatrixResponse = await response.json();
        return data.matrix;
    } catch (error) {
        console.error('[Embedding] Failed to compute similarity matrix:', error);
        return null;
    }
}

/**
 * Process a single log - compute and store its embedding
 */
export async function processLogEmbedding(logId: string, content: string): Promise<boolean> {
    try {
        const result = await computeEmbedding(content);
        if (!result) return false;

        // Store embedding in database
        await db.insert(logEmbeddings).values({
            logId,
            embedding: JSON.stringify(result.embedding),
            dimensions: result.embedding.length,
            chunks: result.chunks
        }).onConflictDoUpdate({
            target: logEmbeddings.logId,
            set: {
                embedding: JSON.stringify(result.embedding),
                dimensions: result.embedding.length,
                chunks: result.chunks,
                createdAt: sql`(unixepoch())`
            }
        });

        console.log(`[Embedding] Processed log ${logId} (${result.chunks} chunks)`);
        return true;
    } catch (error) {
        console.error(`[Embedding] Failed to process log ${logId}:`, error);
        return false;
    }
}

/**
 * Get logs that don't have embeddings yet
 */
export async function getUnprocessedLogs(): Promise<{ id: string; content: string }[]> {
    const result = await db
        .select({
            id: logs.id,
            content: logs.content
        })
        .from(logs)
        .leftJoin(logEmbeddings, eq(logs.id, logEmbeddings.logId))
        .where(isNull(logEmbeddings.logId));

    return result;
}

/**
 * Process all unprocessed logs
 */
export async function processUnprocessedLogs(): Promise<number> {
    const unprocessed = await getUnprocessedLogs();

    if (unprocessed.length === 0) {
        console.log('[Embedding] No unprocessed logs found');
        return 0;
    }

    console.log(`[Embedding] Processing ${unprocessed.length} unprocessed logs...`);

    let processed = 0;
    for (const log of unprocessed) {
        const success = await processLogEmbedding(log.id, log.content);
        if (success) processed++;
    }

    console.log(`[Embedding] Processed ${processed}/${unprocessed.length} logs`);
    return processed;
}

/**
 * Get all embeddings with their log info for graph visualization
 */
export async function getGraphData(limit: number = 10000): Promise<{
    nodes: { id: string; content: string; timestamp: number; tags: any[]; source: string }[];
    embeddings: { logId: string; embedding: number[] }[];
}> {
    // Get logs with embeddings
    const result = await db
        .select({
            logId: logEmbeddings.logId,
            embedding: logEmbeddings.embedding,
            content: logs.content,
            timestamp: logs.timestamp,
            tagsJson: logs.tagsJson,
            source: logs.source
        })
        .from(logEmbeddings)
        .innerJoin(logs, eq(logEmbeddings.logId, logs.id))
        .limit(limit);

    const nodes = result.map(r => ({
        id: r.logId,
        content: r.content,
        timestamp: r.timestamp,
        tags: JSON.parse(r.tagsJson || '[]'),
        source: r.source
    }));

    const embeddings = result.map(r => ({
        logId: r.logId,
        embedding: JSON.parse(r.embedding)
    }));

    return { nodes, embeddings };
}
