import React from 'react';

/**
 * Shared Markdown Renderer Component
 * Used by Auto-Blog preview and Ask Brain chat messages
 * Supports: headings, lists (ordered/unordered/nested), code blocks, 
 *           bold, italic, inline code, horizontal rules, blockquotes
 */

// Helper to render inline markdown (bold, italic, code)
export const renderInlineMarkdown = (text: string): React.ReactNode[] => {
    const result: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    while (remaining.length > 0) {
        // Match patterns: **bold**, *italic*, `code`
        const match = remaining.match(/(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/);

        if (!match || match.index === undefined) {
            result.push(<span key={key++}>{remaining}</span>);
            break;
        }

        // Add text before match
        if (match.index > 0) {
            result.push(<span key={key++}>{remaining.slice(0, match.index)}</span>);
        }

        const fullMatch = match[0];
        if (fullMatch.startsWith('**')) {
            // Bold
            result.push(<strong key={key++} className="font-semibold text-slate-800">{match[2]}</strong>);
        } else if (fullMatch.startsWith('`')) {
            // Inline code
            result.push(<code key={key++} className="px-1.5 py-0.5 bg-slate-100 text-pink-600 rounded text-sm font-mono">{match[4]}</code>);
        } else if (fullMatch.startsWith('*')) {
            // Italic
            result.push(<em key={key++} className="italic">{match[3]}</em>);
        }

        remaining = remaining.slice(match.index + fullMatch.length);
    }

    return result;
};

// Calculate indent level (each 2-3 spaces or tab = 1 level)
const getIndentLevel = (line: string): number => {
    const match = line.match(/^(\s*)/);
    if (!match) return 0;
    const spaces = match[1].replace(/\t/g, '  ').length;
    return Math.floor(spaces / 2);
};

interface MarkdownRendererProps {
    content: string;
    className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
    // Step 1: Strip ```json wrapper if present
    let processedContent = content;
    if (processedContent.trim().startsWith('```')) {
        processedContent = processedContent.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }

    // Step 2: Parse JSON if it looks like JSON
    if (processedContent.trim().startsWith('{')) {
        try {
            const parsed = JSON.parse(processedContent);
            processedContent = parsed.content || processedContent;
        } catch (e) {
            // Not valid JSON, use as-is
        }
    }

    // Step 3: Unescape literal \n to actual newlines
    processedContent = processedContent.replace(/\\n/g, '\n');

    // Pre-process to handle code blocks properly
    const lines = processedContent.split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];
        const trimmedLine = line.trimStart();
        const indentLevel = getIndentLevel(line);

        // Handle code blocks
        if (trimmedLine.startsWith('```')) {
            const codeLines: string[] = [];
            i++; // Skip opening ```
            while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
                codeLines.push(lines[i]);
                i++;
            }
            i++; // Skip closing ```
            elements.push(
                <pre key={`code-${i}`} className="bg-slate-800 text-slate-100 rounded-lg p-4 my-3 overflow-x-auto text-sm font-mono">
                    <code>{codeLines.join('\n')}</code>
                </pre>
            );
            continue;
        }

        // Headings (no indent allowed)
        if (line.startsWith('# ')) {
            elements.push(<h1 key={i} className="text-2xl font-bold text-slate-800 mb-4 mt-6">{renderInlineMarkdown(line.slice(2))}</h1>);
        } else if (line.startsWith('## ')) {
            elements.push(<h2 key={i} className="text-xl font-bold text-slate-800 mt-6 mb-3">{renderInlineMarkdown(line.slice(3))}</h2>);
        } else if (line.startsWith('### ')) {
            elements.push(<h3 key={i} className="text-lg font-semibold text-slate-700 mt-4 mb-2">{renderInlineMarkdown(line.slice(4))}</h3>);

            // Blockquotes (supports nesting with >>)
        } else if (trimmedLine.startsWith('>')) {
            // Count quote level
            const quoteMatch = trimmedLine.match(/^(>+)\s*/);
            const quoteLevel = quoteMatch ? quoteMatch[1].length : 1;
            const quoteContent = trimmedLine.replace(/^>+\s*/, '');
            const marginLeft = `${quoteLevel * 16}px`;
            elements.push(
                <blockquote
                    key={i}
                    className="border-l-4 border-indigo-300 bg-indigo-50/50 pl-4 py-1 my-2 text-slate-600 italic"
                    style={{ marginLeft }}
                >
                    {renderInlineMarkdown(quoteContent)}
                </blockquote>
            );

            // Unordered lists (- or * at start, with optional indent)
        } else if (trimmedLine.match(/^[-*]\s+/)) {
            const listContent = trimmedLine.replace(/^[-*]\s+/, '');
            const marginLeft = `${(indentLevel + 1) * 16}px`;
            elements.push(
                <div key={i} className="flex items-start mb-1 text-slate-600" style={{ marginLeft }}>
                    <span className="mr-2 text-indigo-500">•</span>
                    <span>{renderInlineMarkdown(listContent)}</span>
                </div>
            );

            // Ordered lists (1. 2. 3. at start, with optional indent)
        } else if (trimmedLine.match(/^\d+\.\s+/)) {
            const numMatch = trimmedLine.match(/^(\d+)\.\s+/);
            const num = numMatch ? numMatch[1] : '1';
            const listContent = trimmedLine.replace(/^\d+\.\s+/, '');
            const marginLeft = `${(indentLevel + 1) * 16}px`;
            elements.push(
                <div key={i} className="flex items-start mb-1 text-slate-600" style={{ marginLeft }}>
                    <span className="mr-2 text-indigo-500 font-medium min-w-[20px]">{num}.</span>
                    <span>{renderInlineMarkdown(listContent)}</span>
                </div>
            );

            // Horizontal rule
        } else if (line.trim() === '---' || line.trim() === '***' || line.trim() === '___') {
            elements.push(<hr key={i} className="my-6 border-slate-200" />);

            // Empty lines
        } else if (line.trim() === '') {
            elements.push(<div key={i} className="h-2" />);

            // Regular paragraphs with inline formatting
        } else {
            elements.push(<p key={i} className="mb-2 text-slate-600 leading-relaxed">{renderInlineMarkdown(line)}</p>);
        }

        i++;
    }

    return <div className={className}>{elements}</div>;
};

export default MarkdownRenderer;
