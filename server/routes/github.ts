import { Router } from 'express';
import { db, schema } from '../db';
import { eq, inArray } from 'drizzle-orm';
import { githubService } from '../services/githubService';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// GET /api/github/config - Get GitHub configuration
router.get('/config', async (req, res) => {
    try {
        const tokenRow = await db.select().from(schema.appState).where(eq(schema.appState.key, 'github_token'));
        const usernameRow = await db.select().from(schema.appState).where(eq(schema.appState.key, 'github_username'));
        const reposRow = await db.select().from(schema.appState).where(eq(schema.appState.key, 'github_repos'));
        const activitiesRow = await db.select().from(schema.appState).where(eq(schema.appState.key, 'github_include_activities'));
        const lastSyncRow = await db.select().from(schema.appState).where(eq(schema.appState.key, 'github_last_sync'));

        res.json({
            configured: !!tokenRow[0]?.value,
            username: usernameRow[0]?.value || null,
            selectedRepos: reposRow[0]?.value ? JSON.parse(reposRow[0].value) : [],
            includeActivities: activitiesRow[0]?.value === 'true',
            lastSync: lastSyncRow[0]?.value || null
        });
    } catch (error) {
        console.error('Error fetching GitHub config:', error);
        res.status(500).json({ error: 'Failed to fetch GitHub config' });
    }
});

// POST /api/github/config - Save GitHub configuration
router.post('/config', async (req, res) => {
    try {
        const { token, selectedRepos, includeActivities } = req.body;

        let actualToken = token;
        let username: string;

        // Handle "keep existing token" case
        if (token === 'KEEP_EXISTING' || !token) {
            const existingTokenRow = await db.select().from(schema.appState).where(eq(schema.appState.key, 'github_token'));
            const existingUsernameRow = await db.select().from(schema.appState).where(eq(schema.appState.key, 'github_username'));

            if (!existingTokenRow[0]?.value) {
                return res.status(400).json({ error: 'No existing token found. Please provide a token.' });
            }

            actualToken = existingTokenRow[0].value;
            username = existingUsernameRow[0]?.value || '';
        } else {
            // Validate new token by fetching user info
            const user = await githubService.getAuthenticatedUser(token);
            username = user.login;

            // Save the new token
            const tokenConfig = { key: 'github_token', value: token };
            const existingToken = await db.select().from(schema.appState).where(eq(schema.appState.key, 'github_token'));
            if (existingToken.length > 0) {
                await db.update(schema.appState)
                    .set({ value: token, updatedAt: new Date() })
                    .where(eq(schema.appState.key, 'github_token'));
            } else {
                await db.insert(schema.appState).values(tokenConfig);
            }

            // Save username
            const usernameConfig = { key: 'github_username', value: username };
            const existingUsername = await db.select().from(schema.appState).where(eq(schema.appState.key, 'github_username'));
            if (existingUsername.length > 0) {
                await db.update(schema.appState)
                    .set({ value: username, updatedAt: new Date() })
                    .where(eq(schema.appState.key, 'github_username'));
            } else {
                await db.insert(schema.appState).values(usernameConfig);
            }
        }

        // Always update repos and activities settings
        const configs = [
            { key: 'github_repos', value: JSON.stringify(selectedRepos || []) },
            { key: 'github_include_activities', value: String(includeActivities ?? true) }
        ];

        for (const config of configs) {
            const existing = await db.select().from(schema.appState).where(eq(schema.appState.key, config.key));
            if (existing.length > 0) {
                await db.update(schema.appState)
                    .set({ value: config.value, updatedAt: new Date() })
                    .where(eq(schema.appState.key, config.key));
            } else {
                await db.insert(schema.appState).values(config);
            }
        }

        res.json({
            success: true,
            username,
            message: `GitHub settings updated`
        });
    } catch (error: any) {
        console.error('Error saving GitHub config:', error);
        res.status(400).json({ error: error.message || 'Failed to validate GitHub token' });
    }
});

// GET /api/github/repos - Get user's repositories
router.get('/repos', async (req, res) => {
    try {
        const tokenRow = await db.select().from(schema.appState).where(eq(schema.appState.key, 'github_token'));
        const token = tokenRow[0]?.value;

        if (!token) {
            return res.status(400).json({ error: 'GitHub not configured' });
        }

        const repos = await githubService.getUserRepos(token);
        res.json(repos);
    } catch (error: any) {
        console.error('Error fetching repos:', error);
        res.status(500).json({ error: error.message || 'Failed to fetch repositories' });
    }
});

// POST /api/github/sync - Sync GitHub activity to logs
router.post('/sync', async (req, res) => {
    try {
        const result = await syncGitHubToLogs();
        res.json(result);
    } catch (error: any) {
        console.error('Error syncing GitHub:', error);
        res.status(500).json({ error: error.message || 'Failed to sync GitHub activity' });
    }
});

// DELETE /api/github/config - Disconnect GitHub
router.delete('/config', async (req, res) => {
    try {
        const keys = ['github_token', 'github_username', 'github_repos', 'github_include_activities', 'github_last_sync'];

        for (const key of keys) {
            await db.delete(schema.appState).where(eq(schema.appState.key, key));
        }

        res.json({ success: true, message: 'GitHub disconnected' });
    } catch (error) {
        console.error('Error disconnecting GitHub:', error);
        res.status(500).json({ error: 'Failed to disconnect GitHub' });
    }
});

/**
 * Sync GitHub activity to logs - can be called from route or scheduler
 */
export async function syncGitHubToLogs(): Promise<{
    success: boolean;
    synced: number;
    skipped: number;
    message: string;
}> {
    // Get GitHub config
    const tokenRow = await db.select().from(schema.appState).where(eq(schema.appState.key, 'github_token'));
    const token = tokenRow[0]?.value;

    if (!token) {
        return { success: false, synced: 0, skipped: 0, message: 'GitHub not configured' };
    }

    const usernameRow = await db.select().from(schema.appState).where(eq(schema.appState.key, 'github_username'));
    const reposRow = await db.select().from(schema.appState).where(eq(schema.appState.key, 'github_repos'));
    const activitiesRow = await db.select().from(schema.appState).where(eq(schema.appState.key, 'github_include_activities'));
    const lastSyncRow = await db.select().from(schema.appState).where(eq(schema.appState.key, 'github_last_sync'));

    const config = {
        token,
        username: usernameRow[0]?.value,
        selectedRepos: reposRow[0]?.value ? JSON.parse(reposRow[0].value) : [],
        includeActivities: activitiesRow[0]?.value === 'true'
    };

    // Get existing GitHub commit SHAs for deduplication
    const existingLogs = await db.select({ id: schema.logs.id })
        .from(schema.logs)
        .where(eq(schema.logs.source, 'github'));

    // Also check for SHAs stored in app_state (for activity IDs)
    const existingShasRow = await db.select().from(schema.appState).where(eq(schema.appState.key, 'github_synced_shas'));
    const existingShas = new Set<string>(
        existingShasRow[0]?.value ? JSON.parse(existingShasRow[0].value) : []
    );

    // Determine since date (last sync minus buffer, or 30 days ago)
    // We subtract 1 hour buffer to account for GitHub API delays
    const lastSync = lastSyncRow[0]?.value ? new Date(lastSyncRow[0].value) : undefined;
    const sinceWithBuffer = lastSync
        ? new Date(lastSync.getTime() - 60 * 60 * 1000) // 1 hour buffer
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    console.log(`[GitHub] Syncing since ${sinceWithBuffer.toISOString()} (with 1h buffer)`);

    // Fetch and process GitHub activity
    const syncResult = await githubService.syncGitHubActivity(config, existingShas, sinceWithBuffer);

    // Save new commits/activities as logs
    for (const commit of syncResult.commits) {
        // Double-check for duplicates
        if (existingShas.has(commit.sha)) continue;

        await db.insert(schema.logs).values({
            id: uuidv4(),
            content: commit.content,
            timestamp: commit.timestamp,
            tagsJson: JSON.stringify(commit.tags),
            source: 'github',
            summary: commit.summary,
            needsAiProcessing: commit.tags.length < 2, // Need AI if not enough local tags
            processedForSkillTree: false
        });

        existingShas.add(commit.sha);
    }

    // Update synced SHAs
    const existingShasRowUpdate = await db.select().from(schema.appState).where(eq(schema.appState.key, 'github_synced_shas'));
    if (existingShasRowUpdate.length > 0) {
        await db.update(schema.appState)
            .set({ value: JSON.stringify([...existingShas]), updatedAt: new Date() })
            .where(eq(schema.appState.key, 'github_synced_shas'));
    } else {
        await db.insert(schema.appState).values({
            key: 'github_synced_shas',
            value: JSON.stringify([...existingShas])
        });
    }

    // Update last sync time
    const now = new Date().toISOString();
    const lastSyncUpdate = await db.select().from(schema.appState).where(eq(schema.appState.key, 'github_last_sync'));
    if (lastSyncUpdate.length > 0) {
        await db.update(schema.appState)
            .set({ value: now, updatedAt: new Date() })
            .where(eq(schema.appState.key, 'github_last_sync'));
    } else {
        await db.insert(schema.appState).values({
            key: 'github_last_sync',
            value: now
        });
    }

    console.log(`[GitHub] Sync complete: ${syncResult.synced} synced, ${syncResult.skipped} skipped`);

    return {
        success: true,
        synced: syncResult.synced,
        skipped: syncResult.skipped,
        message: `Synced ${syncResult.synced} new items from GitHub`
    };
}

export default router;
