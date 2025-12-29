import { GoogleGenAI, Type } from "@google/genai";
import { LogEntry, Tag, DailySummary } from "../types";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// Model constants
const FAST_MODEL = 'gemini-3-flash-preview';
const REASONING_MODEL = 'gemini-3-pro-preview';

export const geminiService = {
  /**
   * Analyzes raw text input and extracts structured tags + a micro summary.
   */
  processEntry: async (text: string): Promise<{ tags: Tag[], summary: string }> => {
    const ai = getAI();
    
    const response = await ai.models.generateContent({
      model: FAST_MODEL,
      contents: `Analyze this developer work log entry: "${text}". 
      1. Extract technical tags (Language, Framework, Concept, Task).
      2. Write a very brief (max 10 words) title/summary for this entry.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            tags: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  category: { type: Type.STRING, enum: ['Language', 'Framework', 'Concept', 'Task', 'Other'] }
                }
              }
            }
          }
        }
      }
    });

    const json = JSON.parse(response.text || "{}");
    return {
      tags: json.tags || [],
      summary: json.summary || text.substring(0, 50)
    };
  },

  /**
   * Generates a structured daily summary from a list of logs.
   */
  generateDailySummary: async (date: string, logs: LogEntry[]): Promise<DailySummary> => {
    const ai = getAI();
    const logsText = logs.map(l => `- [${new Date(l.timestamp).toLocaleTimeString()}] ${l.content}`).join('\n');

    const response = await ai.models.generateContent({
      model: FAST_MODEL,
      contents: `You are a Senior Technical Lead. Summarize my work for ${date} based on these logs:\n${logsText}\n
      Output a structured summary, listing key achievements and the tech stack utilized.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            content: { type: Type.STRING, description: "A paragraph summary of the day." },
            keyAchievements: { type: Type.ARRAY, items: { type: Type.STRING } },
            techStackUsed: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      }
    });

    const json = JSON.parse(response.text || "{}");
    return {
      date,
      content: json.content || "No summary available.",
      keyAchievements: json.keyAchievements || [],
      techStackUsed: json.techStackUsed || []
    };
  },

  /**
   * "Ask The Brain" - RAG implementation.
   * Since we use LocalStorage, we pass relevant context directly in the prompt.
   * For a real app, we'd use embedding search here. For this demo, we pass recent/all logs context.
   */
  askBrain: async (query: string, allLogs: LogEntry[]): Promise<string> => {
    const ai = getAI();
    
    // Naive retrieval: Pass the most recent 50 logs or filter by keyword if simple.
    // Ideally, we would generate embeddings here, but let's do context window stuffing for simplicity.
    const context = allLogs.slice(0, 100).map(l => 
      `Date: ${new Date(l.timestamp).toLocaleDateString()} Content: ${l.content} Tags: ${l.tags.map(t => t.name).join(', ')}`
    ).join('\n---\n');

    const response = await ai.models.generateContent({
      model: REASONING_MODEL,
      contents: `Context (My Work History):\n${context}\n\nQuestion: "${query}"\n\n
      Answer the question based strictly on my work history provided above. 
      If I solved a similar problem before, explain how I did it. 
      If not found in context, say so, but offer general advice based on your knowledge.`,
      config: {
        systemInstruction: "You are a helpful AI assistant analyzing a developer's personal work logs to help them recall solutions and track growth."
      }
    });

    return response.text || "I couldn't generate an answer.";
  },

  /**
   * Generates a Blog Post from a range of logs.
   */
  generateBlog: async (logs: LogEntry[], periodName: string): Promise<{ title: string, content: string }> => {
    const ai = getAI();
    const context = logs.map(l => `[${new Date(l.timestamp).toLocaleDateString()}] ${l.content}`).join('\n');

    const response = await ai.models.generateContent({
      model: REASONING_MODEL,
      contents: `Write a high-quality, engaging technical blog post summarizing my work for: ${periodName}.
      
      Raw Logs:
      ${context}

      Guidelines:
      1. Title should be catchy.
      2. Content should be in Markdown.
      3. Group related tasks into sections (e.g., "Feature Development", "Bug Fixes", "Learnings").
      4. Highlight specific technologies mentioned.
      5. Tone: Professional yet personal, like a "Building in Public" update.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            content: { type: Type.STRING }
          }
        }
      }
    });

    const json = JSON.parse(response.text || "{}");
    return {
      title: json.title || `Dev Log: ${periodName}`,
      content: json.content || "Could not generate blog content."
    };
  }
};
