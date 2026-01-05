/**
 * Skill Tree Service
 * AI calls proxied to Python backend
 */

import { db, schema } from '../db';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { Skill } from './types';
import { v4 as uuidv4 } from 'uuid';

const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://localhost:5001';

/**
 * Generate or update skill tree based on unprocessed logs and summaries.
 * Only processes data that hasn't been used for skill tree generation before.
 */
export async function generateSkillTree(): Promise<{
    message: string;
    updated: boolean;
    newSkills: number;
    updatedSkills: number;
}> {
    // 1. Get unprocessed logs
    const unprocessedLogs = await db.select()
        .from(schema.logs)
        .where(eq(schema.logs.processedForSkillTree, false));

    // 2. Get unprocessed summaries
    const unprocessedSummaries = await db.select()
        .from(schema.dailySummaries)
        .where(eq(schema.dailySummaries.processedForSkillTree, false));

    if (unprocessedLogs.length === 0 && unprocessedSummaries.length === 0) {
        return {
            message: 'No new data to process. All logs and summaries have already been analyzed.',
            updated: false,
            newSkills: 0,
            updatedSkills: 0
        };
    }

    console.log(`[SkillTree] Processing ${unprocessedLogs.length} logs and ${unprocessedSummaries.length} summaries`);

    // 3. Get existing skill tree
    const existingSkillTree = await db.select().from(schema.skillTree);

    // 4. Call Python backend for AI analysis
    const response = await fetch(`${PYTHON_BACKEND_URL}/ai/skills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            new_logs: unprocessedLogs.map(l => ({
                id: l.id,
                content: l.content,
                tags_json: l.tagsJson || '[]',
                timestamp: l.timestamp
            })),
            new_summaries: unprocessedSummaries.map(s => ({
                date: s.date,
                content: s.content,
                tech_stack_json: s.techStackJson || '[]'
            })),
            existing_skill_tree: existingSkillTree.map(s => ({
                name: s.name,
                category: s.category,
                maturity_level: s.maturityLevel
            }))
        })
    });

    if (!response.ok) {
        const error = await response.text();
        console.error('[SkillTree] Python backend error:', error);
        throw new Error('Failed to analyze skills');
    }

    const result = await response.json();
    let newSkillsCount = 0;
    let updatedSkillsCount = 0;

    // 5. Merge/update skill tree
    for (const skill of result.skills) {
        const existing = existingSkillTree.find(
            s => s.name.toLowerCase() === skill.name?.toLowerCase()
        );

        if (existing) {
            // Update existing skill
            const existingExamples = JSON.parse(existing.workExamplesJson || '[]');
            const newExamples = skill.work_examples || [];
            const mergedExamples = [...new Set([...existingExamples, ...newExamples])].slice(0, 10);

            await db.update(schema.skillTree)
                .set({
                    maturityLevel: Math.max(existing.maturityLevel, skill.maturity_level || 1),
                    workExamplesJson: JSON.stringify(mergedExamples),
                    lastUpdated: new Date()
                })
                .where(eq(schema.skillTree.id, existing.id));

            updatedSkillsCount++;
        } else if (skill.name) {
            // Insert new skill
            await db.insert(schema.skillTree).values({
                id: uuidv4(),
                name: skill.name,
                category: skill.category || 'Other',
                maturityLevel: skill.maturity_level || 1,
                workExamplesJson: JSON.stringify(skill.work_examples || []),
                relatedLogsJson: JSON.stringify([]),
                firstSeen: new Date(),
                lastUpdated: new Date()
            });

            newSkillsCount++;
        }
    }

    // 6. Mark data as processed
    if (unprocessedLogs.length > 0) {
        await db.update(schema.logs)
            .set({ processedForSkillTree: true })
            .where(inArray(schema.logs.id, unprocessedLogs.map(l => l.id)));
    }

    if (unprocessedSummaries.length > 0) {
        await db.update(schema.dailySummaries)
            .set({ processedForSkillTree: true })
            .where(inArray(schema.dailySummaries.date, unprocessedSummaries.map(s => s.date)));
    }

    console.log(`[SkillTree] Completed: ${newSkillsCount} new, ${updatedSkillsCount} updated`);

    return {
        message: `Skill tree updated. Processed ${unprocessedLogs.length} logs and ${unprocessedSummaries.length} summaries.`,
        updated: true,
        newSkills: newSkillsCount,
        updatedSkills: updatedSkillsCount
    };
}

/**
 * Get the current skill tree
 */
export async function getSkillTree(): Promise<Skill[]> {
    const skills = await db.select().from(schema.skillTree);

    return skills.map(s => ({
        id: s.id,
        name: s.name,
        category: s.category as Skill['category'],
        maturityLevel: s.maturityLevel,
        workExamples: JSON.parse(s.workExamplesJson || '[]'),
        relatedLogs: JSON.parse(s.relatedLogsJson || '[]'),
        firstSeen: s.firstSeen || new Date(),
        lastUpdated: s.lastUpdated || new Date()
    }));
}

/**
 * Get skill tree stats
 */
export async function getSkillTreeStats(): Promise<{
    totalSkills: number;
    byCategory: Record<string, number>;
    averageMaturity: number;
    unprocessedLogs: number;
    unprocessedSummaries: number;
}> {
    const skills = await db.select().from(schema.skillTree);

    const byCategory: Record<string, number> = {};
    let totalMaturity = 0;

    for (const skill of skills) {
        byCategory[skill.category] = (byCategory[skill.category] || 0) + 1;
        totalMaturity += skill.maturityLevel;
    }

    const [logsCount] = await db.select({ count: sql<number>`count(*)` })
        .from(schema.logs)
        .where(eq(schema.logs.processedForSkillTree, false));

    const [summariesCount] = await db.select({ count: sql<number>`count(*)` })
        .from(schema.dailySummaries)
        .where(eq(schema.dailySummaries.processedForSkillTree, false));

    return {
        totalSkills: skills.length,
        byCategory,
        averageMaturity: skills.length > 0 ? totalMaturity / skills.length : 0,
        unprocessedLogs: logsCount?.count || 0,
        unprocessedSummaries: summariesCount?.count || 0
    };
}
