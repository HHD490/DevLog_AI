import { Tag } from '../services/types';

/**
 * Local keyword matching rules for fast tag extraction without AI calls.
 * These rules cover common programming languages, frameworks, and tools.
 */

interface TagRule {
    name: string;
    category: 'Language' | 'Framework' | 'Concept' | 'Task' | 'Other';
    keywords: string[];
}

const TAG_RULES: TagRule[] = [
    // Languages
    { name: 'TypeScript', category: 'Language', keywords: ['typescript', 'ts', '.tsx', '.ts', 'tsc'] },
    { name: 'JavaScript', category: 'Language', keywords: ['javascript', 'js', 'node', 'npm', 'yarn', 'pnpm', '.js', 'es6', 'es2015'] },
    { name: 'Python', category: 'Language', keywords: ['python', 'py', 'pip', '.py', 'python3', 'pytest', 'venv'] },
    { name: 'Rust', category: 'Language', keywords: ['rust', 'cargo', 'rustc', '.rs', 'rustup'] },
    { name: 'Go', category: 'Language', keywords: ['golang', 'go mod', 'go build', '.go'] },
    { name: 'Java', category: 'Language', keywords: ['java', 'maven', 'gradle', '.java', 'jvm', 'spring'] },
    { name: 'C++', category: 'Language', keywords: ['c++', 'cpp', '.cpp', '.hpp', 'cmake', 'g++'] },
    { name: 'C#', category: 'Language', keywords: ['c#', 'csharp', '.cs', 'dotnet', '.net'] },
    { name: 'Ruby', category: 'Language', keywords: ['ruby', 'rails', 'gem', '.rb', 'bundler'] },
    { name: 'PHP', category: 'Language', keywords: ['php', 'composer', 'laravel', '.php'] },
    { name: 'Swift', category: 'Language', keywords: ['swift', 'swiftui', 'xcode', '.swift'] },
    { name: 'Kotlin', category: 'Language', keywords: ['kotlin', '.kt', 'ktx'] },
    { name: 'SQL', category: 'Language', keywords: ['sql', 'mysql', 'postgresql', 'postgres', 'sqlite', 'database', 'query'] },
    { name: 'HTML', category: 'Language', keywords: ['html', '.html', 'dom', 'markup'] },
    { name: 'CSS', category: 'Language', keywords: ['css', '.css', 'scss', 'sass', 'less', 'styling'] },
    { name: 'Shell', category: 'Language', keywords: ['bash', 'shell', 'zsh', '.sh', 'terminal', 'cli'] },

    // Frontend Frameworks
    { name: 'React', category: 'Framework', keywords: ['react', 'jsx', 'hooks', 'usestate', 'useeffect', 'redux', 'context'] },
    { name: 'Vue', category: 'Framework', keywords: ['vue', 'vuex', 'pinia', 'nuxt', '.vue', 'composition api'] },
    { name: 'Angular', category: 'Framework', keywords: ['angular', 'ng', 'rxjs', 'ngrx'] },
    { name: 'Svelte', category: 'Framework', keywords: ['svelte', 'sveltekit', '.svelte'] },
    { name: 'Next.js', category: 'Framework', keywords: ['next.js', 'nextjs', 'getserversideprops', 'getstaticprops', 'app router'] },
    { name: 'Tailwind CSS', category: 'Framework', keywords: ['tailwind', 'tailwindcss', 'tw-'] },
    { name: 'Bootstrap', category: 'Framework', keywords: ['bootstrap', 'btn-', 'container-fluid'] },

    // Backend Frameworks
    { name: 'Express', category: 'Framework', keywords: ['express', 'expressjs', 'middleware', 'router'] },
    { name: 'FastAPI', category: 'Framework', keywords: ['fastapi', 'uvicorn', 'starlette'] },
    { name: 'Django', category: 'Framework', keywords: ['django', 'django rest', 'drf'] },
    { name: 'Flask', category: 'Framework', keywords: ['flask', 'flask-'] },
    { name: 'Spring Boot', category: 'Framework', keywords: ['spring boot', 'springboot', '@autowired', '@restcontroller'] },
    { name: 'NestJS', category: 'Framework', keywords: ['nestjs', '@injectable', '@controller'] },

    // Databases & ORMs
    { name: 'MongoDB', category: 'Framework', keywords: ['mongodb', 'mongoose', 'mongo', 'nosql'] },
    { name: 'PostgreSQL', category: 'Framework', keywords: ['postgresql', 'postgres', 'pg', 'psql'] },
    { name: 'Redis', category: 'Framework', keywords: ['redis', 'cache', 'pub/sub'] },
    { name: 'Prisma', category: 'Framework', keywords: ['prisma', '@prisma/client'] },
    { name: 'Drizzle', category: 'Framework', keywords: ['drizzle', 'drizzle-orm'] },

    // DevOps & Cloud
    { name: 'Docker', category: 'Framework', keywords: ['docker', 'dockerfile', 'container', 'docker-compose'] },
    { name: 'Kubernetes', category: 'Framework', keywords: ['kubernetes', 'k8s', 'kubectl', 'helm'] },
    { name: 'AWS', category: 'Framework', keywords: ['aws', 'amazon web services', 's3', 'ec2', 'lambda', 'cloudfront'] },
    { name: 'GCP', category: 'Framework', keywords: ['gcp', 'google cloud', 'cloud run', 'bigquery'] },
    { name: 'Vercel', category: 'Framework', keywords: ['vercel', 'vercel.json'] },
    { name: 'Netlify', category: 'Framework', keywords: ['netlify'] },

    // AI/ML
    { name: 'TensorFlow', category: 'Framework', keywords: ['tensorflow', 'tf.', 'keras'] },
    { name: 'PyTorch', category: 'Framework', keywords: ['pytorch', 'torch.', 'nn.module'] },
    { name: 'OpenAI', category: 'Framework', keywords: ['openai', 'gpt', 'chatgpt', 'gpt-4', 'dall-e'] },
    { name: 'LangChain', category: 'Framework', keywords: ['langchain', 'llm', 'rag'] },
    { name: 'Gemini', category: 'Framework', keywords: ['gemini', 'google ai', 'genai'] },

    // Testing
    { name: 'Jest', category: 'Framework', keywords: ['jest', 'describe(', 'it(', 'expect('] },
    { name: 'Vitest', category: 'Framework', keywords: ['vitest'] },
    { name: 'Cypress', category: 'Framework', keywords: ['cypress', 'cy.'] },
    { name: 'Playwright', category: 'Framework', keywords: ['playwright', '@playwright'] },

    // Concepts
    { name: 'API', category: 'Concept', keywords: ['api', 'rest', 'graphql', 'endpoint', 'webhook'] },
    { name: 'Authentication', category: 'Concept', keywords: ['auth', 'jwt', 'oauth', 'token', 'login', 'session'] },
    { name: 'Testing', category: 'Concept', keywords: ['test', 'unit test', 'integration test', 'e2e', 'tdd'] },
    { name: 'CI/CD', category: 'Concept', keywords: ['ci/cd', 'pipeline', 'github actions', 'jenkins', 'deployment'] },
    { name: 'Performance', category: 'Concept', keywords: ['optimization', 'performance', 'caching', 'lazy load'] },
    { name: 'Security', category: 'Concept', keywords: ['security', 'encryption', 'xss', 'csrf', 'vulnerability'] },
    { name: 'Refactoring', category: 'Concept', keywords: ['refactor', 'cleanup', 'code review', 'technical debt'] },

    // Tasks
    { name: 'Bug Fix', category: 'Task', keywords: ['fix', 'bug', 'issue', 'error', 'debug', 'resolve'] },
    { name: 'Feature', category: 'Task', keywords: ['feature', 'implement', 'add', 'create', 'build'] },
    { name: 'Documentation', category: 'Task', keywords: ['docs', 'documentation', 'readme', 'comment'] },
    { name: 'Configuration', category: 'Task', keywords: ['config', 'setup', 'install', 'configure'] },
    { name: 'Learning', category: 'Task', keywords: ['learn', 'study', 'tutorial', 'course', 'research'] },
    { name: 'Meeting', category: 'Task', keywords: ['meeting', 'discussion', 'sync', 'standup', 'review'] },
];

/**
 * Extract tags from content using local keyword matching.
 * This is fast and doesn't require AI API calls.
 */
export function matchLocalTags(content: string): Tag[] {
    const lowerContent = content.toLowerCase();
    const matchedTags: Tag[] = [];
    const matchedNames = new Set<string>();

    for (const rule of TAG_RULES) {
        if (matchedNames.has(rule.name)) continue;

        for (const keyword of rule.keywords) {
            let matches = false;

            // Use word boundary matching for short keywords to avoid false positives
            if (keyword.length <= 3) {
                const pattern = new RegExp(`\\b${escapeRegex(keyword)}\\b`, 'i');
                matches = pattern.test(content);
            } else {
                matches = lowerContent.includes(keyword.toLowerCase());
            }

            if (matches) {
                matchedTags.push({
                    name: rule.name,
                    category: rule.category
                });
                matchedNames.add(rule.name);
                break;
            }
        }
    }

    return matchedTags;
}

/**
 * Generate a simple local summary (first sentence or first N words)
 */
export function generateLocalSummary(content: string, maxWords: number = 10): string {
    // Try to get first sentence
    const sentenceMatch = content.match(/^[^.!?]+[.!?]/);
    if (sentenceMatch && sentenceMatch[0].split(/\s+/).length <= maxWords) {
        return sentenceMatch[0].trim();
    }

    // Otherwise get first N words
    const words = content.split(/\s+/).slice(0, maxWords);
    return words.join(' ') + (content.split(/\s+/).length > maxWords ? '...' : '');
}

function escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check if local tags are sufficient (no AI needed)
 * Returns true if we have at least 2 good tags
 */
export function hasEnoughLocalTags(tags: Tag[]): boolean {
    // Need at least one non-Task tag and total >= 2
    const nonTaskTags = tags.filter(t => t.category !== 'Task' && t.category !== 'Other');
    return tags.length >= 2 && nonTaskTags.length >= 1;
}
