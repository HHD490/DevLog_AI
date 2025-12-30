import React, { useState, useEffect, useMemo } from 'react';
import { Skill } from '../types';
import { apiService } from '../services/apiService';
import { TreePine, RefreshCw, Sparkles, Code2, Wrench, Lightbulb, Server, ChevronDown, ChevronRight } from 'lucide-react';

interface SkillTreeProps { }

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
    'Language': <Code2 className="w-4 h-4" />,
    'Framework': <Server className="w-4 h-4" />,
    'Tool': <Wrench className="w-4 h-4" />,
    'Concept': <Lightbulb className="w-4 h-4" />,
    'Platform': <Server className="w-4 h-4" />,
};

const CATEGORY_COLORS: Record<string, string> = {
    'Language': 'bg-blue-50 text-blue-700 border-blue-200',
    'Framework': 'bg-purple-50 text-purple-700 border-purple-200',
    'Tool': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Concept': 'bg-amber-50 text-amber-700 border-amber-200',
    'Platform': 'bg-rose-50 text-rose-700 border-rose-200',
};

const MATURITY_COLORS = [
    'bg-slate-200',
    'bg-indigo-200',
    'bg-indigo-400',
    'bg-indigo-500',
    'bg-indigo-600',
];

export const SkillTree: React.FC<SkillTreeProps> = () => {
    const [skills, setSkills] = useState<Skill[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [stats, setStats] = useState<{
        unprocessedLogs: number;
        unprocessedSummaries: number;
    } | null>(null);
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);
            const [skillsData, statsData] = await Promise.all([
                apiService.getSkillTree(),
                apiService.getSkillTreeStats()
            ]);
            setSkills(skillsData);
            setStats(statsData);
            // Expand all categories by default
            const categories = new Set(skillsData.map(s => s.category));
            setExpandedCategories(categories);
        } catch (e) {
            setError('Failed to load skill tree. Is the backend running?');
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleGenerate = async () => {
        try {
            setGenerating(true);
            setError(null);
            const result = await apiService.generateSkillTree();
            if (result.updated) {
                await loadData();
            }
            alert(result.message);
        } catch (e) {
            setError('Failed to generate skill tree');
            console.error(e);
        } finally {
            setGenerating(false);
        }
    };

    const toggleCategory = (category: string) => {
        const newExpanded = new Set(expandedCategories);
        if (newExpanded.has(category)) {
            newExpanded.delete(category);
        } else {
            newExpanded.add(category);
        }
        setExpandedCategories(newExpanded);
    };

    const groupedSkills = useMemo(() => {
        const groups: Record<string, Skill[]> = {};
        skills.forEach(skill => {
            if (!groups[skill.category]) {
                groups[skill.category] = [];
            }
            groups[skill.category].push(skill);
        });
        // Sort by category and within each category by maturity level (descending)
        Object.keys(groups).forEach(category => {
            groups[category].sort((a, b) => b.maturityLevel - a.maturityLevel);
        });
        return groups;
    }, [skills]);

    const renderMaturityStars = (level: number) => {
        return (
            <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map(i => (
                    <div
                        key={i}
                        className={`w-2 h-2 rounded-full ${i <= level ? MATURITY_COLORS[level - 1] : 'bg-slate-200'}`}
                    />
                ))}
            </div>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header with Generate Button */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <TreePine className="w-7 h-7 text-emerald-500" />
                        Skill Tree
                    </h2>
                    <p className="text-slate-500 mt-1">
                        Your technical skills based on work history
                    </p>
                </div>
                <button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-lg shadow-indigo-200 transition-all disabled:opacity-70"
                >
                    {generating ? (
                        <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Generating...
                        </>
                    ) : (
                        <>
                            <Sparkles className="w-4 h-4" />
                            Generate / Update
                        </>
                    )}
                </button>
            </div>

            {/* Stats Card */}
            {stats && (
                <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-6 text-sm">
                        <div>
                            <span className="text-slate-500">Total Skills:</span>
                            <span className="ml-2 font-semibold text-slate-800">{skills.length}</span>
                        </div>
                        <div className="h-4 w-px bg-slate-200" />
                        <div>
                            <span className="text-slate-500">Unprocessed Logs:</span>
                            <span className={`ml-2 font-semibold ${stats.unprocessedLogs > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
                                {stats.unprocessedLogs}
                            </span>
                        </div>
                        <div className="h-4 w-px bg-slate-200" />
                        <div>
                            <span className="text-slate-500">Unprocessed Summaries:</span>
                            <span className={`ml-2 font-semibold ${stats.unprocessedSummaries > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
                                {stats.unprocessedSummaries}
                            </span>
                        </div>
                    </div>
                    {(stats.unprocessedLogs > 0 || stats.unprocessedSummaries > 0) && (
                        <p className="text-xs text-amber-600 mt-2">
                            💡 You have unprocessed data. Click "Generate / Update" to analyze new entries.
                        </p>
                    )}
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
                    {error}
                </div>
            )}

            {/* Empty State */}
            {skills.length === 0 && !error && (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                    <TreePine className="w-16 h-16 mb-4 text-slate-300" />
                    <p className="text-lg font-medium">No skills discovered yet</p>
                    <p className="text-sm mt-1">Add some work logs and generate your skill tree!</p>
                </div>
            )}

            {/* Skills by Category */}
            <div className="space-y-4">
                {Object.entries(groupedSkills).map(([category, categorySkills]: [string, Skill[]]) => (
                    <div key={category} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                        {/* Category Header */}
                        <button
                            onClick={() => toggleCategory(category)}
                            className="w-full px-4 py-3 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors"
                        >
                            <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${CATEGORY_COLORS[category] || 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                                {CATEGORY_ICONS[category]}
                                <span className="font-semibold">{category}</span>
                                <span className="text-xs opacity-70">({categorySkills.length})</span>
                            </div>
                            {expandedCategories.has(category) ? (
                                <ChevronDown className="w-5 h-5 text-slate-400" />
                            ) : (
                                <ChevronRight className="w-5 h-5 text-slate-400" />
                            )}
                        </button>

                        {/* Skills List */}
                        {expandedCategories.has(category) && (
                            <div className="p-4 space-y-3">
                                {categorySkills.map(skill => (
                                    <div key={skill.id} className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                                        <div className="flex items-center justify-between mb-2">
                                            <h4 className="font-semibold text-slate-800">{skill.name}</h4>
                                            {renderMaturityStars(skill.maturityLevel)}
                                        </div>
                                        {skill.workExamples && skill.workExamples.length > 0 && (
                                            <div className="space-y-1 mt-3">
                                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Work Examples</p>
                                                <ul className="text-sm text-slate-600 space-y-1">
                                                    {skill.workExamples.slice(0, 5).map((example, i) => (
                                                        <li key={i} className="flex items-start gap-2">
                                                            <span className="text-indigo-400 mt-1">•</span>
                                                            <span>{example}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};
