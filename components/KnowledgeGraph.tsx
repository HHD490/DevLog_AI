import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Network, ZoomIn, ZoomOut, RefreshCw, X, Loader, AlertCircle, Sliders } from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';

interface GraphNode {
    id: string;
    content: string;
    timestamp: number;
    tags: { name: string; category: string }[];
    source: string;
}

interface GraphEdge {
    source: string;
    target: string;
    weight: number;
}

interface GraphData {
    nodes: GraphNode[];
    edges: GraphEdge[];
}

interface NodePosition {
    id: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
}

// Color palette for different tag categories
const CATEGORY_COLORS: Record<string, string> = {
    Language: '#3b82f6',
    Framework: '#8b5cf6',
    Tool: '#10b981',
    Concept: '#f59e0b',
    Platform: '#ef4444',
    default: '#6b7280'
};

export const KnowledgeGraph: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [graphData, setGraphData] = useState<GraphData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [serviceOnline, setServiceOnline] = useState<boolean | null>(null);

    const [similarityThreshold, setSimilarityThreshold] = useState(0);
    const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
    const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);

    const [zoom, setZoom] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    const [nodePositions, setNodePositions] = useState<NodePosition[]>([]);
    const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
    const animationRef = useRef<number>();
    const [isSimulating, setIsSimulating] = useState(false);
    const iterationRef = useRef(0);

    // Check embedding service health
    const checkHealth = useCallback(async () => {
        try {
            const res = await fetch('/api/graph/health');
            if (res.ok) {
                const data = await res.json();
                setServiceOnline(data.status === 'ok');
            } else {
                setServiceOnline(false);
            }
        } catch {
            setServiceOnline(false);
        }
    }, []);

    // Fetch graph data - always fetch all edges, filter locally
    const fetchGraphData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/graph/data?minSimilarity=0');
            if (!res.ok) throw new Error('Failed to fetch graph data');
            const data = await res.json();
            setGraphData(data);

            // Get current canvas size from container
            const containerWidth = containerRef.current?.clientWidth || 800;
            const containerHeight = containerRef.current?.clientHeight || 600;

            // Initialize node positions centered in canvas
            if (data.nodes.length > 0) {
                const centerX = containerWidth / 2;
                const centerY = containerHeight / 2;
                const radius = Math.min(containerWidth, containerHeight) * 0.35;

                const positions = data.nodes.map((node: GraphNode, i: number) => {
                    // Arrange in a circle initially
                    const angle = (2 * Math.PI * i) / data.nodes.length;
                    return {
                        id: node.id,
                        x: centerX + Math.cos(angle) * radius * (0.5 + Math.random() * 0.5),
                        y: centerY + Math.sin(angle) * radius * (0.5 + Math.random() * 0.5),
                        vx: 0,
                        vy: 0
                    };
                });
                setNodePositions(positions);
                iterationRef.current = 0;
                setIsSimulating(true);
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    // Filter edges based on threshold (computed, not refetched)
    const filteredEdges = graphData?.edges.filter(e => e.weight >= similarityThreshold) || [];

    // Trigger processing
    const triggerProcessing = async () => {
        try {
            const res = await fetch('/api/graph/process', { method: 'POST' });
            const data = await res.json();
            if (!res.ok) {
                alert(`Error: ${data.error || 'Failed'}`);
                return;
            }
            alert(`Processed ${data.processed ?? 0} logs`);
            fetchGraphData();
        } catch {
            alert('Failed to process logs');
        }
    };

    // Force-directed simulation
    useEffect(() => {
        if (!isSimulating || !graphData || nodePositions.length === 0) return;

        const MAX_ITERATIONS = 200;
        const centerX = canvasSize.width / 2;
        const centerY = canvasSize.height / 2;
        const topEdges = filteredEdges.slice(0, 100);

        const simulate = () => {
            iterationRef.current++;

            setNodePositions(prev => {
                const positions = prev.map(p => ({ ...p, vx: 0, vy: 0 }));
                const posMap = new Map<string, NodePosition>(positions.map(p => [p.id, p]));

                // Repulsion
                for (let i = 0; i < positions.length; i++) {
                    for (let j = i + 1; j < positions.length; j++) {
                        const a = positions[i];
                        const b = positions[j];
                        let dx = b.x - a.x || 0.1;
                        let dy = b.y - a.y || 0.1;
                        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                        const force = 10000 / (dist * dist);
                        const fx = (dx / dist) * force;
                        const fy = (dy / dist) * force;
                        a.vx -= fx;
                        a.vy -= fy;
                        b.vx += fx;
                        b.vy += fy;
                    }
                }

                // Attraction
                topEdges.forEach(edge => {
                    const a = posMap.get(edge.source) as NodePosition | undefined;
                    const b = posMap.get(edge.target) as NodePosition | undefined;
                    if (!a || !b) return;
                    const dx = b.x - a.x;
                    const dy = b.y - a.y;
                    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                    const force = dist * 0.003 * edge.weight;
                    a.vx += (dx / dist) * force;
                    a.vy += (dy / dist) * force;
                    b.vx -= (dx / dist) * force;
                    b.vy -= (dy / dist) * force;
                });

                // Center gravity
                positions.forEach(p => {
                    p.vx += (centerX - p.x) * 0.01;
                    p.vy += (centerY - p.y) * 0.01;
                });

                // Apply with damping
                let movement = 0;
                const padding = 60;
                positions.forEach(p => {
                    const vel = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
                    if (vel > 15) {
                        p.vx = (p.vx / vel) * 15;
                        p.vy = (p.vy / vel) * 15;
                    }
                    p.x += p.vx * 0.3;
                    p.y += p.vy * 0.3;
                    movement += vel;
                    p.x = Math.max(padding, Math.min(canvasSize.width - padding, p.x));
                    p.y = Math.max(padding, Math.min(canvasSize.height - padding, p.y));
                });

                if (movement < 1 || iterationRef.current >= MAX_ITERATIONS) {
                    setIsSimulating(false);
                }

                return positions;
            });

            animationRef.current = requestAnimationFrame(simulate);
        };

        animationRef.current = requestAnimationFrame(simulate);
        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, [isSimulating, graphData, nodePositions.length, canvasSize]);

    // Draw canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !graphData) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const posMap = new Map(nodePositions.map(p => [p.id, p]));

        // Clear
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);

        ctx.save();
        ctx.translate(offset.x, offset.y);
        ctx.scale(zoom, zoom);

        // Draw edges (use filtered edges)
        filteredEdges.slice(0, 100).forEach(edge => {
            const s = posMap.get(edge.source) as NodePosition | undefined;
            const t = posMap.get(edge.target) as NodePosition | undefined;
            if (!s || !t) return;
            ctx.strokeStyle = `rgba(99, 102, 241, ${0.1 + edge.weight * 0.5})`;
            ctx.lineWidth = 0.5 + edge.weight * 1.5;
            ctx.beginPath();
            ctx.moveTo(s.x, s.y);
            ctx.lineTo(t.x, t.y);
            ctx.stroke();
        });

        // Draw nodes
        graphData.nodes.forEach(node => {
            const pos = posMap.get(node.id) as NodePosition | undefined;
            if (!pos) return;
            const isHovered = hoveredNode?.id === node.id;
            const isSelected = selectedNode?.id === node.id;
            const tag = node.tags[0];
            const color = tag ? (CATEGORY_COLORS[tag.category] || CATEGORY_COLORS.default) : CATEGORY_COLORS.default;
            const r = isHovered || isSelected ? 12 : 8;

            ctx.beginPath();
            ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();

            if (isSelected) {
                ctx.strokeStyle = '#1f2937';
                ctx.lineWidth = 3;
                ctx.stroke();
            } else if (isHovered) {
                ctx.strokeStyle = '#4f46e5';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        });

        ctx.restore();
    }, [graphData, nodePositions, zoom, offset, hoveredNode, selectedNode, canvasSize]);

    // Canvas resize
    useEffect(() => {
        const updateSize = () => {
            if (containerRef.current && canvasRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                const w = Math.floor(rect.width);
                const h = Math.floor(rect.height);
                if (w > 0 && h > 0) {
                    setCanvasSize({ width: w, height: h });
                    const dpr = window.devicePixelRatio || 1;
                    canvasRef.current.width = w * dpr;
                    canvasRef.current.height = h * dpr;
                }
            }
        };

        updateSize();
        const timer1 = setTimeout(updateSize, 100);
        const timer2 = setTimeout(updateSize, 500);

        const observer = new ResizeObserver(updateSize);
        if (containerRef.current) observer.observe(containerRef.current);

        return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
            observer.disconnect();
        };
    }, [graphData]);

    // Mouse handlers
    const getMousePos = (e: React.MouseEvent) => {
        if (!canvasRef.current) return { x: 0, y: 0 };
        const rect = canvasRef.current.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left - offset.x) / zoom,
            y: (e.clientY - rect.top - offset.y) / zoom
        };
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging) {
            setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
            return;
        }

        if (!graphData) return;
        const { x, y } = getMousePos(e);
        const posMap = new Map<string, NodePosition>(nodePositions.map(p => [p.id, p]));

        let found: GraphNode | null = null;
        for (const node of graphData.nodes) {
            const pos = posMap.get(node.id);
            if (!pos) continue;
            const dist = Math.sqrt((pos.x - x) ** 2 + (pos.y - y) ** 2);
            if (dist < 20) {
                found = node;
                break;
            }
        }
        setHoveredNode(found);
    };

    const handleMouseUp = () => setIsDragging(false);

    const handleClick = () => {
        if (hoveredNode) setSelectedNode(hoveredNode);
        else setSelectedNode(null);
    };

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const factor = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(0.3, Math.min(3, zoom * factor));

        // Adjust offset to zoom toward mouse position
        const dx = mouseX - offset.x;
        const dy = mouseY - offset.y;
        setOffset({
            x: offset.x - dx * (factor - 1),
            y: offset.y - dy * (factor - 1)
        });

        setZoom(newZoom);
    };

    // Zoom with buttons centers on canvas
    const zoomIn = () => {
        const centerX = canvasSize.width / 2;
        const centerY = canvasSize.height / 2;
        const factor = 1.2;
        const newZoom = Math.min(3, zoom * factor);
        const dx = centerX - offset.x;
        const dy = centerY - offset.y;
        setOffset({
            x: offset.x - dx * (factor - 1),
            y: offset.y - dy * (factor - 1)
        });
        setZoom(newZoom);
    };

    const zoomOut = () => {
        const centerX = canvasSize.width / 2;
        const centerY = canvasSize.height / 2;
        const factor = 1 / 1.2;
        const newZoom = Math.max(0.3, zoom * factor);
        const dx = centerX - offset.x;
        const dy = centerY - offset.y;
        setOffset({
            x: offset.x - dx * (factor - 1),
            y: offset.y - dy * (factor - 1)
        });
        setZoom(newZoom);
    };

    // Initial load
    useEffect(() => {
        checkHealth();
        // Delay to ensure container is sized
        const timer = setTimeout(() => {
            fetchGraphData();
        }, 200);
        return () => clearTimeout(timer);
    }, []);

    // Restart simulation when threshold changes (edges filter locally)
    useEffect(() => {
        if (graphData && nodePositions.length > 0) {
            iterationRef.current = 0;
            setIsSimulating(true);
        }
    }, [similarityThreshold]);

    return (
        <div
            style={{
                width: 'calc(100% + 4rem)',
                height: 'calc(100vh - 80px)',
                margin: '-1rem -2rem -2rem -2rem',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: '#f8fafc',
                overflow: 'hidden'
            }}
        >
            {/* Header */}
            <div style={{
                backgroundColor: 'white',
                borderBottom: '1px solid #e2e8f0',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Network style={{ width: 24, height: 24, color: '#4f46e5' }} />
                    <span style={{ fontSize: 18, fontWeight: 700, color: '#1e293b' }}>Knowledge Graph</span>
                    {graphData && (
                        <span style={{ fontSize: 14, color: '#64748b' }}>
                            {graphData.nodes.length} nodes, {filteredEdges.length} edges
                        </span>
                    )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 12,
                        color: serviceOnline ? '#059669' : '#dc2626'
                    }}>
                        <div style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            backgroundColor: serviceOnline ? '#10b981' : '#ef4444'
                        }} />
                        {serviceOnline ? 'Online' : 'Offline'}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, color: '#64748b' }}>相似度:</span>
                        <Sliders style={{ width: 16, height: 16, color: '#94a3b8' }} />
                        <input
                            type="range"
                            min="0"
                            max="0.99"
                            step="0.01"
                            value={similarityThreshold}
                            onChange={(e) => setSimilarityThreshold(parseFloat(e.target.value))}
                            style={{ width: 100 }}
                        />
                        <span style={{ fontSize: 12, color: '#64748b', width: 45 }}>≥{similarityThreshold.toFixed(2)}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <button onClick={zoomIn} style={{ padding: 6, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                            <ZoomIn style={{ width: 18, height: 18, color: '#475569' }} />
                        </button>
                        <span style={{ fontSize: 12, color: '#64748b', minWidth: 40, textAlign: 'center', lineHeight: '30px' }}>{Math.round(zoom * 100)}%</span>
                        <button onClick={zoomOut} style={{ padding: 6, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                            <ZoomOut style={{ width: 18, height: 18, color: '#475569' }} />
                        </button>
                    </div>

                    <button onClick={fetchGraphData} disabled={loading} style={{ padding: 6, background: 'none', border: 'none', cursor: 'pointer' }}>
                        <RefreshCw style={{ width: 18, height: 18, color: '#475569', animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                    </button>

                    {serviceOnline && (
                        <button
                            onClick={triggerProcessing}
                            style={{
                                padding: '6px 12px',
                                backgroundColor: '#4f46e5',
                                color: 'white',
                                border: 'none',
                                borderRadius: 6,
                                fontSize: 14,
                                cursor: 'pointer'
                            }}
                        >
                            Process Logs
                        </button>
                    )}
                </div>
            </div>

            {/* Canvas Container */}
            <div
                ref={containerRef}
                style={{
                    flex: 1,
                    position: 'relative',
                    overflow: 'hidden',
                    minHeight: 400
                }}
            >
                {loading ? (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Loader style={{ width: 32, height: 32, color: '#4f46e5', animation: 'spin 1s linear infinite' }} />
                    </div>
                ) : error ? (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ textAlign: 'center', color: '#64748b' }}>
                            <AlertCircle style={{ width: 48, height: 48, color: '#f87171', marginBottom: 8 }} />
                            <p>{error}</p>
                            <button onClick={fetchGraphData} style={{ marginTop: 16, padding: '8px 16px', backgroundColor: '#4f46e5', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                                Retry
                            </button>
                        </div>
                    </div>
                ) : graphData?.nodes.length === 0 ? (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ textAlign: 'center', color: '#64748b' }}>
                            <Network style={{ width: 48, height: 48, color: '#cbd5e1', marginBottom: 8 }} />
                            <p>No embeddings yet</p>
                            {serviceOnline && (
                                <button onClick={triggerProcessing} style={{ marginTop: 16, padding: '8px 16px', backgroundColor: '#4f46e5', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                                    Process All Logs
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <canvas
                        ref={canvasRef}
                        style={{
                            display: 'block',
                            width: '100%',
                            height: '100%',
                            cursor: isDragging ? 'grabbing' : 'crosshair'
                        }}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        onClick={handleClick}
                        onWheel={handleWheel}
                    />
                )}

                {/* Tooltip */}
                {hoveredNode && !selectedNode && (
                    <div
                        style={{
                            position: 'absolute',
                            left: (nodePositions.find(p => p.id === hoveredNode.id)?.x || 0) * zoom + offset.x + 20,
                            top: (nodePositions.find(p => p.id === hoveredNode.id)?.y || 0) * zoom + offset.y - 10,
                            backgroundColor: 'white',
                            padding: 12,
                            borderRadius: 8,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                            maxWidth: 280,
                            pointerEvents: 'none',
                            zIndex: 10
                        }}
                    >
                        <p style={{ fontSize: 13, color: '#334155', margin: 0, lineHeight: 1.4 }}>
                            {hoveredNode.content.slice(0, 150)}...
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                            {hoveredNode.tags.slice(0, 5).map((tag, i) => (
                                <span key={i} style={{ fontSize: 10, padding: '2px 6px', backgroundColor: '#f1f5f9', color: '#475569', borderRadius: 4 }}>
                                    {tag.name}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            {selectedNode && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        zIndex: 50,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 16
                    }}
                    onClick={() => setSelectedNode(null)}
                >
                    <div
                        style={{
                            backgroundColor: 'white',
                            borderRadius: 16,
                            maxWidth: 640,
                            width: '100%',
                            maxHeight: '80vh',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{ padding: 16, borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 14, color: '#64748b' }}>
                                {new Date(selectedNode.timestamp).toLocaleString()}
                            </span>
                            <button onClick={() => setSelectedNode(null)} style={{ padding: 8, background: 'none', border: 'none', cursor: 'pointer' }}>
                                <X style={{ width: 20, height: 20, color: '#64748b' }} />
                            </button>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
                            <MarkdownRenderer content={selectedNode.content} />
                        </div>
                        {selectedNode.tags.length > 0 && (
                            <div style={{ padding: 16, borderTop: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                    {selectedNode.tags.map((tag, i) => (
                                        <span
                                            key={i}
                                            style={{
                                                fontSize: 11,
                                                fontWeight: 600,
                                                padding: '4px 8px',
                                                borderRadius: 4,
                                                backgroundColor: tag.category === 'Language' ? '#dbeafe' : tag.category === 'Framework' ? '#ede9fe' : '#f1f5f9',
                                                color: tag.category === 'Language' ? '#2563eb' : tag.category === 'Framework' ? '#7c3aed' : '#475569'
                                            }}
                                        >
                                            {tag.name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default KnowledgeGraph;
