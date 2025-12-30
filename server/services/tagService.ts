import { db, schema } from '../db';
import { eq, and, sql } from 'drizzle-orm';
import { geminiService } from './geminiService';
import { matchLocalTags, generateLocalSummary, hasEnoughLocalTags } from '../utils/localTagRules';
import { Tag } from './types';

/**
 * Process a single entry with local-first approach.
 * Uses local rules first, only marks for AI processing if needed.
 */
export async function processEntryWithLocalFirst(content: string): Promise<{
    tags: Tag[];
    summary: string;
    needsAiProcessing: boolean;
}> {
    // 1. Try local matching first
    const localTags = matchLocalTags(content);
    const localSummary = generateLocalSummary(content);

    // 2. Check if local results are sufficient
    if (hasEnoughLocalTags(localTags)) {
        return {
            tags: localTags,
            summary: localSummary,
            needsAiProcessing: false
        };
    }

    // 3. Local results insufficient, mark for AI processing
    return {
        tags: localTags, // Still return local tags as starting point
        summary: localSummary,
        needsAiProcessing: true
    };
}

/**
 * Batch process all pending entries that need AI processing.
 * Called periodically by the scheduler.
 */
export async function batchProcessPendingEntries(): Promise<{ processed: number }> {
    // Get all entries that need AI processing
    const pending = await db.select()
        .from(schema.logs)
        .where(eq(schema.logs.needsAiProcessing, true))
        .limit(20); // Process in batches of 20

    if (pending.length === 0) {
        return { processed: 0 };
    }

    console.log(`[TagService] Processing ${pending.length} pending entries...`);

    try {
        // Batch process with AI
        const results = await geminiService.batchProcessEntries(
            pending.map(p => ({ id: p.id, content: p.content }))
        );

        // Update each entry
        for (const entry of pending) {
            const result = results.get(entry.id);
            if (result) {
                // Merge local tags with AI tags (local tags as base, AI adds more)
                const existingTags: Tag[] = JSON.parse(entry.tagsJson || '[]');
                const mergedTags = mergeTags(existingTags, result.tags);

                await db.update(schema.logs)
                    .set({
                        tagsJson: JSON.stringify(mergedTags),
                        summary: result.summary,
                        needsAiProcessing: false,
                        updatedAt: new Date()
                    })
                    .where(eq(schema.logs.id, entry.id));
            }
        }

        console.log(`[TagService] Successfully processed ${pending.length} entries`);
        return { processed: pending.length };

    } catch (error) {
        console.error('[TagService] Batch processing failed:', error);
        throw error;
    }
}

/**
 * Merge two tag arrays, avoiding duplicates
 */
function mergeTags(existing: Tag[], newTags: Tag[]): Tag[] {
    const tagMap = new Map<string, Tag>();

    // Add existing tags
    for (const tag of existing) {
        tagMap.set(tag.name.toLowerCase(), tag);
    }

    // Add new tags (won't override existing)
    for (const tag of newTags) {
        if (!tagMap.has(tag.name.toLowerCase())) {
            tagMap.set(tag.name.toLowerCase(), tag);
        }
    }

    return Array.from(tagMap.values());
}

/**
 * Get processing stats
 */
export async function getProcessingStats(): Promise<{
    totalLogs: number;
    pendingAiProcessing: number;
    pendingSkillTree: number;
}> {
    const [total] = await db.select({ count: sql<number>`count(*)` }).from(schema.logs);
    const [pendingAi] = await db.select({ count: sql<number>`count(*)` })
        .from(schema.logs)
        .where(eq(schema.logs.needsAiProcessing, true));
    const [pendingSkill] = await db.select({ count: sql<number>`count(*)` })
        .from(schema.logs)
        .where(eq(schema.logs.processedForSkillTree, false));

    return {
        totalLogs: total?.count || 0,
        pendingAiProcessing: pendingAi?.count || 0,
        pendingSkillTree: pendingSkill?.count || 0
    };
}
