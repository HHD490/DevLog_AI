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

            // Horizontal rule (but not table separator)
        } else if ((line.trim() === '---' || line.trim() === '***' || line.trim() === '___') && !line.includes('|')) {
            elements.push(<hr key={i} className="my-6 border-slate-200" />);

            // Tables: detect table start (line with | characters)
        } else if (trimmedLine.includes('|') && trimmedLine.startsWith('|')) {
            const tableRows: string[][] = [];
            let hasHeader = false;

            // Collect all table rows
            while (i < lines.length) {
                const tableLine = lines[i].trim();
                if (!tableLine.includes('|')) break;

                // Parse cells: split by |, remove empty first/last from leading/trailing |
                const cells = tableLine.split('|')
                    .map(cell => cell.trim())
                    .filter((_, idx, arr) => idx !== 0 && idx !== arr.length - 1 || arr[idx] !== '');

                // Clean up: remove empty strings at start/end caused by | at line boundaries
                const cleanCells = tableLine.startsWith('|') && tableLine.endsWith('|')
                    ? tableLine.slice(1, -1).split('|').map(c => c.trim())
                    : cells;

                // Check if this is a separator row (|---|---|)
                if (cleanCells.every(cell => /^[-:]+$/.test(cell))) {
                    hasHeader = true;
                    i++;
                    continue;
                }

                tableRows.push(cleanCells);
                i++;
            }

            if (tableRows.length > 0) {
                const headerRow = hasHeader ? tableRows[0] : null;
                const bodyRows = hasHeader ? tableRows.slice(1) : tableRows;

                elements.push(
                    <div key={`table-${i}`} className="my-4 overflow-x-auto">
                        <table className="min-w-full border-collapse border border-slate-300 text-sm">
                            {headerRow && (
                                <thead className="bg-slate-100">
                                    <tr>
                                        {headerRow.map((cell, cellIdx) => (
                                            <th
                                                key={cellIdx}
                                                className="border border-slate-300 px-3 py-2 text-left font-semibold text-slate-700"
                                            >
                                                {renderInlineMarkdown(cell)}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                            )}
                            <tbody>
                                {bodyRows.map((row, rowIdx) => (
                                    <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                        {row.map((cell, cellIdx) => (
                                            <td
                                                key={cellIdx}
                                                className="border border-slate-300 px-3 py-2 text-slate-600"
                                            >
                                                {renderInlineMarkdown(cell)}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );
            }
            continue;

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
