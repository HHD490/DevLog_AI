import { Tag } from './types';
import { matchLocalTags } from '../utils/localTagRules';

interface GitHubEvent {
    id: string;
    type: string;
    created_at: string;
    repo: {
        id: number;
        name: string;
        url: string;
    };
    payload: any;
}

interface GitHubCommit {
    sha: string;
    message: string;
    date: string;
    repo: string;
    url: string;
    needsMessageFetch?: boolean;
}

interface SyncResult {
    synced: number;
    skipped: number;
    errors: string[];
    commits: {
        sha: string;
        content: string;
        timestamp: number;
        repo: string;
        tags: Tag[];
        summary: string;
    }[];
}

interface GitHubConfig {
    token: string;
    username?: string;
    selectedRepos?: string[]; // If empty/null, sync all repos
    includeActivities?: boolean; // Include issues, PRs, etc.
}

const GITHUB_API_BASE = 'https://api.github.com';

/**
 * GitHub Service for fetching user activity and commits
 */
export const githubService = {
    /**
     * Fetch authenticated user info
     */
    async getAuthenticatedUser(token: string): Promise<{ login: string; name: string; avatar_url: string }> {
        const response = await fetch(`${GITHUB_API_BASE}/user`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'X-GitHub-Api-Version': '2022-11-28'
            }
        });

        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
        }

        return response.json();
    },

    /**
     * Fetch commit details by SHA to get the actual commit message
     */
    async getCommitDetails(token: string, repoFullName: string, sha: string): Promise<{ message: string } | null> {
        try {
            const response = await fetch(
                `${GITHUB_API_BASE}/repos/${repoFullName}/commits/${sha}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'X-GitHub-Api-Version': '2022-11-28'
                    }
                }
            );

            if (!response.ok) {
                console.error(`[GitHub] Failed to fetch commit ${sha}: ${response.status}`);
                return null;
            }

            const data = await response.json();
            return { message: data.commit?.message || '' };
        } catch (error) {
            console.error(`[GitHub] Error fetching commit ${sha}:`, error);
            return null;
        }
    },

    /**
     * Fetch user's repositories
     */
    async getUserRepos(token: string): Promise<{ name: string; full_name: string; private: boolean }[]> {
        const repos: any[] = [];
        let page = 1;
        const perPage = 100;

        while (true) {
            const response = await fetch(
                `${GITHUB_API_BASE}/user/repos?per_page=${perPage}&page=${page}&sort=updated`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'X-GitHub-Api-Version': '2022-11-28'
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status}`);
            }

            const data = await response.json();
            if (data.length === 0) break;

            repos.push(...data.map((r: any) => ({
                name: r.name,
                full_name: r.full_name,
                private: r.private
            })));

            if (data.length < perPage) break;
            page++;
        }

        return repos;
    },

    /**
     * Fetch user events (commits, issues, PRs, etc.)
     */
    async getUserEvents(token: string, username: string, since?: Date): Promise<GitHubEvent[]> {
        const events: GitHubEvent[] = [];
        let page = 1;
        const perPage = 100;
        const sinceTime = since?.getTime() || 0;

        while (page <= 10) { // GitHub limits to 10 pages (300 events)
            const response = await fetch(
                `${GITHUB_API_BASE}/users/${username}/events?per_page=${perPage}&page=${page}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'X-GitHub-Api-Version': '2022-11-28'
                    }
                }
            );

            if (!response.ok) {
                if (response.status === 404) break;
                throw new Error(`GitHub API error: ${response.status}`);
            }

            const data = await response.json();
            if (data.length === 0) break;

            // Filter by date if provided
            const filtered = data.filter((e: GitHubEvent) => {
                const eventTime = new Date(e.created_at).getTime();
                return eventTime > sinceTime;
            });

            events.push(...filtered);

            // If we got events older than our since date, we can stop
            if (filtered.length < data.length) break;
            if (data.length < perPage) break;
            page++;
        }

        return events;
    },

    /**
     * Extract commits from push events
     */
    extractCommitsFromEvents(events: GitHubEvent[], config: GitHubConfig): GitHubCommit[] {
        const commits: GitHubCommit[] = [];
        // selectedRepos can be either "repo" or "owner/repo" format
        const selectedRepos = config.selectedRepos && config.selectedRepos.length > 0
            ? new Set(config.selectedRepos)
            : null;

        for (const event of events) {
            // Filter by selected repos if specified
            // event.repo.name is in format "owner/repo", so check both formats
            if (selectedRepos) {
                const repoFullName = event.repo.name; // "HHD490/DevLog_AI"
                const repoShortName = event.repo.name.split('/').pop() || ''; // "DevLog_AI"
                if (!selectedRepos.has(repoFullName) && !selectedRepos.has(repoShortName)) {
                    continue;
                }
            }

            if (event.type === 'PushEvent') {
                // GitHub Events API sometimes returns commits array, sometimes just head/before
                if (event.payload.commits && event.payload.commits.length > 0) {
                    for (const commit of event.payload.commits) {
                        commits.push({
                            sha: commit.sha,
                            message: commit.message,
                            date: event.created_at,
                            repo: event.repo.name,
                            url: `https://github.com/${event.repo.name}/commit/${commit.sha}`,
                            needsMessageFetch: false
                        });
                    }
                } else if (event.payload.head) {
                    // Mark this commit as needing message fetch
                    commits.push({
                        sha: event.payload.head,
                        message: '', // Will be fetched later
                        date: event.created_at,
                        repo: event.repo.name,
                        url: `https://github.com/${event.repo.name}/commit/${event.payload.head}`,
                        needsMessageFetch: true
                    });
                }
            }
        }

        return commits;
    },

    /**
     * Extract activities (issues, PRs, etc.) from events
     */
    extractActivitiesFromEvents(events: GitHubEvent[], config: GitHubConfig): { content: string; timestamp: number; type: string; repo: string }[] {
        if (!config.includeActivities) return [];

        const activities: { content: string; timestamp: number; type: string; repo: string }[] = [];
        const selectedRepos = config.selectedRepos && config.selectedRepos.length > 0
            ? new Set(config.selectedRepos)
            : null;

        for (const event of events) {
            // Filter by selected repos if specified
            // event.repo.name is in format "owner/repo", so check both formats
            if (selectedRepos) {
                const repoFullName = event.repo.name;
                const repoShortName = event.repo.name.split('/').pop() || '';
                if (!selectedRepos.has(repoFullName) && !selectedRepos.has(repoShortName)) {
                    continue;
                }
            }

            let content = '';
            const timestamp = new Date(event.created_at).getTime();

            switch (event.type) {
                case 'IssueCommentEvent':
                    content = `Commented on issue #${event.payload.issue?.number}: "${event.payload.comment?.body?.substring(0, 100)}..."`;
                    break;
                case 'IssuesEvent':
                    content = `${event.payload.action} issue #${event.payload.issue?.number}: ${event.payload.issue?.title}`;
                    break;
                case 'PullRequestEvent':
                    content = `${event.payload.action} PR #${event.payload.pull_request?.number}: ${event.payload.pull_request?.title}`;
                    break;
                case 'PullRequestReviewEvent':
                    content = `Reviewed PR #${event.payload.pull_request?.number}: ${event.payload.review?.state}`;
                    break;
                case 'CreateEvent':
                    content = `Created ${event.payload.ref_type} ${event.payload.ref || ''} in ${event.repo.name}`;
                    break;
                case 'DeleteEvent':
                    content = `Deleted ${event.payload.ref_type} ${event.payload.ref} in ${event.repo.name}`;
                    break;
                case 'ForkEvent':
                    content = `Forked ${event.repo.name}`;
                    break;
                case 'WatchEvent':
                    content = `Starred ${event.repo.name}`;
                    break;
                default:
                    continue; // Skip other event types
            }

            if (content) {
                activities.push({
                    content: `[${event.repo.name}] ${content}`,
                    timestamp,
                    type: event.type,
                    repo: event.repo.name
                });
            }
        }

        return activities;
    },

    /**
     * Sync GitHub activity to logs
     * Returns commits/activities ready to be saved as LogEntries
     */
    async syncGitHubActivity(
        config: GitHubConfig,
        existingCommitShas: Set<string>,
        since?: Date
    ): Promise<SyncResult> {
        const result: SyncResult = {
            synced: 0,
            skipped: 0,
            errors: [],
            commits: []
        };

        try {
            // Get username
            const user = await this.getAuthenticatedUser(config.token);
            const username = config.username || user.login;

            // Fetch events
            const events = await this.getUserEvents(config.token, username, since);
            console.log(`[GitHub] Fetched ${events.length} events for ${username}`);

            // Extract commits
            const commits = this.extractCommitsFromEvents(events, config);

            // Process commits with deduplication
            for (const commit of commits) {
                // Skip if already exists
                if (existingCommitShas.has(commit.sha)) {
                    result.skipped++;
                    continue;
                }

                let message = commit.message;

                // Fetch actual commit message if needed
                if (commit.needsMessageFetch) {
                    console.log(`[GitHub] Fetching commit message for ${commit.sha.substring(0, 7)}...`);
                    const details = await this.getCommitDetails(config.token, commit.repo, commit.sha);
                    if (details && details.message) {
                        message = details.message;
                    } else {
                        // Fallback if fetch fails
                        message = `Push to ${commit.repo.split('/').pop()} branch`;
                    }
                }

                // Extract tags using local rules
                const tags = matchLocalTags(message);

                // Generate summary (first line of commit message)
                const summary = message.split('\n')[0].substring(0, 80);

                result.commits.push({
                    sha: commit.sha,
                    content: `[${commit.repo}] ${message}`,
                    timestamp: new Date(commit.date).getTime(),
                    repo: commit.repo,
                    tags,
                    summary
                });
                result.synced++;
            }

            // Extract activities if enabled
            if (config.includeActivities) {
                const activities = this.extractActivitiesFromEvents(events, config);
                for (const activity of activities) {
                    const tags = matchLocalTags(activity.content);
                    result.commits.push({
                        sha: `activity-${activity.timestamp}-${activity.type}`,
                        content: activity.content,
                        timestamp: activity.timestamp,
                        repo: activity.repo,
                        tags,
                        summary: activity.content.substring(0, 80)
                    });
                    result.synced++;
                }
            }

        } catch (error: any) {
            result.errors.push(error.message || 'Unknown error');
            console.error('[GitHub] Sync error:', error);
        }

        return result;
    }
};
