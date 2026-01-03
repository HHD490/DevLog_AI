/**
 * AI Service - Unified AI functions using the provider abstraction
 * Supports DeepSeek (default) and Gemini as providers
 */

import { getAIProvider } from './aiProvider';
import { Tag, DailySummary, Skill } from './types';

/**
 * Helper to parse JSON from AI response (handles markdown code blocks)
 */
function parseJsonResponse(responseText: string): any {
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) ||
        responseText.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : responseText;
    return JSON.parse(jsonStr);
}

export const aiService = {
    /**
     * Analyzes raw text input and extracts structured tags + a micro summary.
     */
    processEntry: async (text: string): Promise<{ tags: Tag[], summary: string }> => {
        const provider = getAIProvider();

        const prompt = `Analyze this developer work log entry: "${text}". 
    1. Extract technical tags (Language, Framework, Concept, Task).
    2. Write a very brief (max 10 words) title/summary for this entry.
    
    Respond in JSON format:
    {
      "summary": "string",
      "tags": [{"name": "string", "category": "Language|Framework|Concept|Task|Other"}]
    }`;

        try {
            const responseText = await provider.generateContent(prompt);
            const json = parseJsonResponse(responseText);
            return {
                tags: json.tags || [],
                summary: json.summary || text.substring(0, 50)
            };
        } catch (e) {
            console.error('Failed to process entry:', e);
            return { tags: [], summary: text.substring(0, 50) };
        }
    },

    /**
     * Batch process multiple entries for tag extraction
     */
    batchProcessEntries: async (entries: { id: string, content: string }[]): Promise<Map<string, { tags: Tag[], summary: string }>> => {
        const provider = getAIProvider();
        const entriesText = entries.map((e, i) => `[${i}] ${e.content}`).join('\n\n');

        const prompt = `Analyze these developer work log entries and extract tags and summaries for each:

${entriesText}

For each entry, extract technical tags (Language, Framework, Concept, Task) and write a brief summary.

Respond in JSON format:
{
  "results": [
    {"index": 0, "summary": "string", "tags": [{"name": "string", "category": "Language|Framework|Concept|Task|Other"}]},
    ...
  ]
}`;

        const resultMap = new Map<string, { tags: Tag[], summary: string }>();

        try {
            const responseText = await provider.generateContent(prompt);
            const json = parseJsonResponse(responseText);

            for (const r of json.results || []) {
                const entry = entries[r.index];
                if (entry) {
                    resultMap.set(entry.id, {
                        tags: r.tags || [],
                        summary: r.summary || entry.content.substring(0, 50)
                    });
                }
            }
        } catch (e) {
            console.error('Failed to parse batch AI response:', e);
        }

        return resultMap;
    },

    /**
     * Generates a structured daily summary from a list of logs.
     * Identifies GitHub commits and provides AI-enhanced interpretation.
     */
    generateDailySummary: async (date: string, logs: { timestamp: number, content: string, source?: string }[]): Promise<DailySummary> => {
        const provider = getAIProvider();

        // Separate manual logs from GitHub commits
        const manualLogs = logs.filter(l => l.source !== 'github');
        const githubLogs = logs.filter(l => l.source === 'github');

        const manualLogsText = manualLogs.length > 0
            ? manualLogs.map(l => `- [${new Date(l.timestamp).toLocaleTimeString()}] ${l.content}`).join('\n')
            : '(No manual logs today)';

        const githubLogsText = githubLogs.length > 0
            ? githubLogs.map(l => `- [${new Date(l.timestamp).toLocaleTimeString()}] ${l.content}`).join('\n')
            : '';

        const prompt = `You are a Senior Technical Lead. Summarize my work for ${date} based on these logs:

=== MANUAL WORK LOGS ===
${manualLogsText}

${githubLogs.length > 0 ? `=== GITHUB COMMITS (Need Interpretation) ===
${githubLogsText}

Note: The GitHub commits above are raw commit messages synced from my repositories. 
Please interpret what kind of work these commits represent based on:
- Repository names (e.g., [HHD490/DevLog_AI] suggests working on the DevLog AI project)
- Commit message patterns (feat:, fix:, refactor:, etc.)
- Any technical keywords

In your summary, clearly indicate which parts are interpreted from GitHub commits vs. manual logs.
` : ''}

Output a structured summary in JSON format:
{
  "content": "A paragraph summary of the day. ${githubLogs.length > 0 ? "Include a section starting with '📎 From GitHub:' to summarize work interpreted from commits." : ''}",
  "keyAchievements": ["achievement 1", "achievement 2"],
  "techStackUsed": ["tech1", "tech2"]
}`;

        console.log('[AI] Generating daily summary for', date, 'with', logs.length, 'logs');

        try {
            const responseText = await provider.generateContent(prompt);
            console.log('[AI] Response received, length:', responseText.length);

            const json = parseJsonResponse(responseText);
            return {
                date,
                content: json.content || 'No summary available.',
                keyAchievements: json.keyAchievements || [],
                techStackUsed: json.techStackUsed || []
            };
        } catch (e: any) {
            console.error('[AI] Failed to generate daily summary:', e.message || e);
            return {
                date,
                content: 'Failed to generate summary.',
                keyAchievements: [],
                techStackUsed: []
            };
        }
    },

    /**
     * "Ask The Brain" - RAG implementation (single query).
     */
    askBrain: async (query: string, allLogs: { timestamp: number, content: string, tags: Tag[] }[]): Promise<string> => {
        const provider = getAIProvider();

        const context = allLogs.slice(0, 100).map(l =>
            `Date: ${new Date(l.timestamp).toLocaleDateString()} Content: ${l.content} Tags: ${l.tags.map(t => t.name).join(', ')}`
        ).join('\n---\n');

        const prompt = `Context (My Work History):
${context}

Question: "${query}"

Answer the question based strictly on my work history provided above. 
If I solved a similar problem before, explain how I did it. 
If not found in context, say so, but offer general advice based on your knowledge.`;

        try {
            const response = await provider.generateContent(prompt);
            return response || "I couldn't generate an answer.";
        } catch (e) {
            console.error('[AI] Ask Brain failed:', e);
            return "Failed to generate an answer. Please try again.";
        }
    },

    /**
     * "Ask The Brain" with conversation context - supports multi-turn dialogue.
     * Uses the last 5 rounds (10 messages) for context plus work logs for RAG.
     */
    askBrainWithContext: async (
        messages: { role: 'user' | 'assistant', content: string }[],
        allLogs: { timestamp: number, content: string, tags: Tag[] }[]
    ): Promise<string> => {
        const provider = getAIProvider();

        // Build work history context for RAG
        const logsContext = allLogs.slice(0, 50).map(l =>
            `[${new Date(l.timestamp).toLocaleDateString()}] ${l.content}`
        ).join('\n');

        // Build conversation history
        const conversationHistory = messages.map(m =>
            `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
        ).join('\n\n');

        const prompt = `You are a helpful AI assistant that knows my work history. Answer based on my work logs when relevant, and provide helpful responses in a conversational manner.

=== MY WORK HISTORY ===
${logsContext}

=== CONVERSATION HISTORY ===
${conversationHistory}

Continue the conversation naturally. If the user asks about my past work, refer to the work history above. Format your response with Markdown when appropriate (code blocks, lists, etc.).`;

        try {
            const response = await provider.generateContent(prompt);
            return response || "I couldn't generate an answer.";
        } catch (e: any) {
            console.error('[AI] Ask Brain with context failed:', e);
            return `Sorry, I encountered an error: ${e.message || 'Unknown error'}. Please try again.`;
        }
    },

    /**
     * Generate a short title for a conversation based on the first message.
     */
    generateConversationTitle: async (firstMessage: string): Promise<string> => {
        const provider = getAIProvider();

        const prompt = `Generate a very short title (max 5 words) for a conversation that starts with this message:
"${firstMessage}"

Respond with ONLY the title, no quotes, no explanation.`;

        try {
            const response = await provider.generateContent(prompt);
            // Clean up the response
            const title = response.trim().replace(/^["']|["']$/g, '').substring(0, 50);
            return title || 'New Chat';
        } catch (e) {
            console.error('[AI] Generate title failed:', e);
            return 'New Chat';
        }
    },

    /**
     * Generates a Blog Post from a range of logs.
     */
    generateBlog: async (logs: { timestamp: number, content: string }[], periodName: string): Promise<{ title: string, content: string }> => {
        const provider = getAIProvider();

        const context = logs.map(l => `[${new Date(l.timestamp).toLocaleDateString()}] ${l.content}`).join('\n');

        const prompt = `Write a high-quality, engaging technical blog post summarizing my work for: ${periodName}.
      
Raw Logs:
${context}

Guidelines:
1. Title should be catchy.
2. Content should be in Markdown.
3. Group related tasks into sections (e.g., "Feature Development", "Bug Fixes", "Learnings").
4. Highlight specific technologies mentioned.
5. Tone: Professional yet personal, like a "Building in Public" update.

Respond in JSON format:
{
  "title": "string",
  "content": "markdown string"
}`;

        console.log('[AI] Generating blog for', periodName, 'with', logs.length, 'logs');

        try {
            const responseText = await provider.generateContent(prompt);
            console.log('[AI] Blog response length:', responseText.length);

            // Try to parse JSON response
            try {
                const json = parseJsonResponse(responseText);
                if (json.title && json.content) {
                    return {
                        title: json.title,
                        content: json.content
                    };
                }
            } catch (parseError) {
                console.log('[AI] JSON parse failed, trying alternative parsing');
            }

            // Fallback: if response doesn't parse as JSON, treat the whole response as content
            // and generate a title from the period name
            if (responseText && responseText.length > 100) {
                return {
                    title: `Dev Log: ${periodName}`,
                    content: responseText
                };
            }

            return {
                title: `Dev Log: ${periodName}`,
                content: 'Could not generate blog content.'
            };
        } catch (e: any) {
            console.error('[AI] Blog generation failed:', e.message || e);
            return {
                title: `Dev Log: ${periodName}`,
                content: `Failed to generate blog: ${e.message || 'Unknown error'}`
            };
        }
    },

    /**
     * Analyze logs and summaries to generate/update skill tree
     */
    analyzeForSkillTree: async (params: {
        newLogs: { id: string, content: string, tagsJson: string, timestamp: number }[],
        newSummaries: { date: string, content: string, techStackJson: string }[],
        existingSkillTree: Skill[]
    }): Promise<{ skills: Partial<Skill>[] }> => {
        const provider = getAIProvider();

        const logsContext = params.newLogs.map(l => {
            const tags = JSON.parse(l.tagsJson || '[]');
            return `[${new Date(l.timestamp).toLocaleDateString()}] ${l.content} (Tags: ${tags.map((t: Tag) => t.name).join(', ')})`;
        }).join('\n');

        const summariesContext = params.newSummaries.map(s => {
            const techStack = JSON.parse(s.techStackJson || '[]');
            return `[${s.date}] ${s.content} (Tech: ${techStack.join(', ')})`;
        }).join('\n');

        const existingSkillsContext = params.existingSkillTree.map(s =>
            `${s.name} (${s.category}): Level ${s.maturityLevel}/5`
        ).join('\n');

        const prompt = `Analyze the following new work logs and daily summaries to update a developer's skill tree.

NEW LOGS:
${logsContext || 'None'}

NEW SUMMARIES:
${summariesContext || 'None'}

EXISTING SKILL TREE:
${existingSkillsContext || 'None'}

Based on the new data, identify skills to add or update. Consider:
1. Only include skills with sufficient evidence (mentioned multiple times or with depth)
2. Maturity level 1-5 based on: frequency, depth of work, variety of applications
3. Include specific work examples for each skill
4. Categories: Language, Framework, Tool, Concept, Platform

Respond in JSON format:
{
  "skills": [
    {
      "name": "React",
      "category": "Framework",
      "maturityLevel": 4,
      "workExamples": ["Built dashboard with hooks", "Implemented state management"],
      "isUpdate": true
    }
  ]
}

Only include skills that have strong evidence in the new data. Set maturityLevel to at least the existing level if updating.`;

        try {
            const responseText = await provider.generateContent(prompt);
            const json = parseJsonResponse(responseText);
            return { skills: json.skills || [] };
        } catch (e) {
            console.error('[AI] Skill tree analysis failed:', e);
            return { skills: [] };
        }
    }
};

// Export for backward compatibility (rename from geminiService)
export const geminiService = aiService;
