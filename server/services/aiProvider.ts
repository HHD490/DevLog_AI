/**
 * AI Provider Abstraction Layer
 * Supports multiple AI providers: DeepSeek (default), Gemini
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// Types
export interface AIMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface AICompletionOptions {
    temperature?: number;
    maxTokens?: number;
}

export interface AIProvider {
    name: string;
    generateContent(prompt: string, options?: AICompletionOptions): Promise<string>;
    generateChat(messages: AIMessage[], options?: AICompletionOptions): Promise<string>;
}

// Environment variable names
const ENV_KEYS = {
    DEEPSEEK_API_KEY: 'DEEPSEEK_API_KEY',
    GEMINI_API_KEY: 'GEMINI_API_KEY',
    AI_PROVIDER: 'AI_PROVIDER' // 'deepseek' or 'gemini'
};

/**
 * DeepSeek Provider (OpenAI-compatible API)
 */
class DeepSeekProvider implements AIProvider {
    name = 'DeepSeek';
    private apiKey: string;
    private baseUrl = 'https://api.deepseek.com/v1';
    private model = 'deepseek-chat';

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    async generateContent(prompt: string, options?: AICompletionOptions): Promise<string> {
        return this.generateChat([{ role: 'user', content: prompt }], options);
    }

    async generateChat(messages: AIMessage[], options?: AICompletionOptions): Promise<string> {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                model: this.model,
                messages: messages.map(m => ({ role: m.role, content: m.content })),
                temperature: options?.temperature ?? 0.7,
                max_tokens: options?.maxTokens ?? 4096
            })
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('[DeepSeek] API Error:', response.status, error);
            throw new Error(`DeepSeek API error: ${response.status} - ${error}`);
        }

        const data = await response.json();
        return data.choices[0]?.message?.content || '';
    }
}

/**
 * Gemini Provider
 */
class GeminiProvider implements AIProvider {
    name = 'Gemini';
    private ai: GoogleGenerativeAI;
    private model = 'gemini-2.0-flash';

    constructor(apiKey: string) {
        this.ai = new GoogleGenerativeAI(apiKey);
    }

    async generateContent(prompt: string, options?: AICompletionOptions): Promise<string> {
        const model = this.ai.getGenerativeModel({ model: this.model });
        const result = await model.generateContent(prompt);
        return result.response.text();
    }

    async generateChat(messages: AIMessage[], options?: AICompletionOptions): Promise<string> {
        // Gemini doesn't have a direct chat API like OpenAI, 
        // so we format messages into a single prompt
        const formattedPrompt = messages.map(m => {
            if (m.role === 'system') return `System: ${m.content}`;
            if (m.role === 'user') return `User: ${m.content}`;
            return `Assistant: ${m.content}`;
        }).join('\n\n');

        return this.generateContent(formattedPrompt, options);
    }
}

/**
 * Get the current AI provider based on environment configuration
 * Priority: AI_PROVIDER env var -> DeepSeek if key exists -> Gemini if key exists -> Error
 */
export function getAIProvider(): AIProvider {
    const preferredProvider = process.env[ENV_KEYS.AI_PROVIDER]?.toLowerCase();
    const deepseekKey = process.env[ENV_KEYS.DEEPSEEK_API_KEY];
    const geminiKey = process.env[ENV_KEYS.GEMINI_API_KEY];

    // If provider is explicitly set
    if (preferredProvider === 'deepseek' && deepseekKey) {
        console.log('[AI] Using DeepSeek provider');
        return new DeepSeekProvider(deepseekKey);
    }
    if (preferredProvider === 'gemini' && geminiKey) {
        console.log('[AI] Using Gemini provider');
        return new GeminiProvider(geminiKey);
    }

    // Default priority: DeepSeek > Gemini (DeepSeek has better rate limits)
    if (deepseekKey) {
        console.log('[AI] Using DeepSeek provider (default)');
        return new DeepSeekProvider(deepseekKey);
    }
    if (geminiKey) {
        console.log('[AI] Using Gemini provider (fallback)');
        return new GeminiProvider(geminiKey);
    }

    throw new Error('No AI API key configured. Please set DEEPSEEK_API_KEY or GEMINI_API_KEY in .env.local');
}

/**
 * Get provider name for display
 */
export function getCurrentProviderName(): string {
    try {
        return getAIProvider().name;
    } catch {
        return 'None';
    }
}
