import { GoogleGenerativeAI } from '@google/generative-ai';
import { Tag, DailySummary, Skill } from './types';

const getAI = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not set');
    }
    return new GoogleGenerativeAI(apiKey);
};

// Model constants
const FAST_MODEL = 'gemini-2.0-flash';
const REASONING_MODEL = 'gemini-2.0-flash';

export const geminiService = {
    /**
     * Analyzes raw text input and extracts structured tags + a micro summary.
     */
    processEntry: async (text: string): Promise<{ tags: Tag[], summary: string }> => {
        const ai = getAI();
        const model = ai.getGenerativeModel({ model: FAST_MODEL });

        const prompt = `Analyze this developer work log entry: "${text}". 
    1. Extract technical tags (Language, Framework, Concept, Task).
    2. Write a very brief (max 10 words) title/summary for this entry.
    
    Respond in JSON format:
    {
      "summary": "string",
      "tags": [{"name": "string", "category": "Language|Framework|Concept|Task|Other"}]
    }`;

        const result = await model.generateContent(prompt);
        const response = result.response;
        const responseText = response.text();

        try {
            // Extract JSON from response (handle markdown code blocks)
            const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) ||
                responseText.match(/\{[\s\S]*\}/);
            const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : responseText;
            const json = JSON.parse(jsonStr);
            return {
                tags: json.tags || [],
                summary: json.summary || text.substring(0, 50)
            };
        } catch (e) {
            console.error('Failed to parse AI response:', e);
            return { tags: [], summary: text.substring(0, 50) };
        }
    },

    /**
     * Batch process multiple entries for tag extraction
     */
    batchProcessEntries: async (entries: { id: string, content: string }[]): Promise<Map<string, { tags: Tag[], summary: string }>> => {
        const ai = getAI();
        const model = ai.getGenerativeModel({ model: FAST_MODEL });

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

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        const resultMap = new Map<string, { tags: Tag[], summary: string }>();

        try {
            const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) ||
                responseText.match(/\{[\s\S]*\}/);
            const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : responseText;
            const json = JSON.parse(jsonStr);

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
        const ai = getAI();
        const model = ai.getGenerativeModel({ model: FAST_MODEL });

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

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        try {
            const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) ||
                responseText.match(/\{[\s\S]*\}/);
            const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : responseText;
            const json = JSON.parse(jsonStr);
            return {
                date,
                content: json.content || 'No summary available.',
                keyAchievements: json.keyAchievements || [],
                techStackUsed: json.techStackUsed || []
            };
        } catch (e) {
            console.error('Failed to parse daily summary response:', e);
            return {
                date,
                content: 'Failed to generate summary.',
                keyAchievements: [],
                techStackUsed: []
            };
        }
    },

    /**
     * "Ask The Brain" - RAG implementation.
     */
    askBrain: async (query: string, allLogs: { timestamp: number, content: string, tags: Tag[] }[]): Promise<string> => {
        const ai = getAI();
        const model = ai.getGenerativeModel({ model: REASONING_MODEL });

        const context = allLogs.slice(0, 100).map(l =>
            `Date: ${new Date(l.timestamp).toLocaleDateString()} Content: ${l.content} Tags: ${l.tags.map(t => t.name).join(', ')}`
        ).join('\n---\n');

        const prompt = `Context (My Work History):
${context}

Question: "${query}"

Answer the question based strictly on my work history provided above. 
If I solved a similar problem before, explain how I did it. 
If not found in context, say so, but offer general advice based on your knowledge.`;

        const result = await model.generateContent(prompt);
        return result.response.text() || "I couldn't generate an answer.";
    },

    /**
     * Generates a Blog Post from a range of logs.
     */
    generateBlog: async (logs: { timestamp: number, content: string }[], periodName: string): Promise<{ title: string, content: string }> => {
        const ai = getAI();
        const model = ai.getGenerativeModel({ model: REASONING_MODEL });

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

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        try {
            const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) ||
                responseText.match(/\{[\s\S]*\}/);
            const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : responseText;
            const json = JSON.parse(jsonStr);
            return {
                title: json.title || `Dev Log: ${periodName}`,
                content: json.content || 'Could not generate blog content.'
            };
        } catch (e) {
            console.error('Failed to parse blog response:', e);
            return {
                title: `Dev Log: ${periodName}`,
                content: 'Could not generate blog content.'
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
        const ai = getAI();
        const model = ai.getGenerativeModel({ model: REASONING_MODEL });

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

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        try {
            const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) ||
                responseText.match(/\{[\s\S]*\}/);
            const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : responseText;
            const json = JSON.parse(jsonStr);
            return { skills: json.skills || [] };
        } catch (e) {
            console.error('Failed to parse skill tree response:', e);
            return { skills: [] };
        }
    }
};
