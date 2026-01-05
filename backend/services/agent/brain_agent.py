"""
Brain Agent - LangGraph implementation for intelligent Q&A
Supports multi-path retrieval: date filtering, tag filtering, semantic search
"""

import logging
import re
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, TypedDict
import numpy as np

from langgraph.graph import StateGraph, END

from llm import get_llm
from services.database import get_all_logs, get_logs_by_date_range, get_logs_by_tags, get_log_embeddings

logger = logging.getLogger(__name__)


class AgentState(TypedDict):
    """State for the Brain Agent."""
    query: str
    conversation_history: List[Dict[str, str]]
    intent: Optional[Dict[str, Any]]
    retrieved_logs: List[Dict[str, Any]]
    answer: str


def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """Compute cosine similarity between two vectors."""
    v1 = np.array(vec1)
    v2 = np.array(vec2)
    dot = np.dot(v1, v2)
    norm1 = np.linalg.norm(v1)
    norm2 = np.linalg.norm(v2)
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return float(dot / (norm1 * norm2))


class BrainAgent:
    """
    Intelligent Q&A Agent using LangGraph.
    
    Flow:
    1. Parse user intent (date, tags, semantic query)
    2. Multi-path retrieval based on intent
    3. Generate answer with retrieved context
    """
    
    def __init__(self, llm=None):
        self.llm = llm or get_llm()
        self.graph = self._build_graph()
    
    def _build_graph(self) -> StateGraph:
        """Build the LangGraph workflow."""
        workflow = StateGraph(AgentState)
        
        # Add nodes
        workflow.add_node("parse_intent", self._parse_intent)
        workflow.add_node("retrieve_logs", self._retrieve_logs)
        workflow.add_node("generate_answer", self._generate_answer)
        
        # Define edges
        workflow.add_edge("parse_intent", "retrieve_logs")
        workflow.add_edge("retrieve_logs", "generate_answer")
        workflow.add_edge("generate_answer", END)
        
        # Set entry point
        workflow.set_entry_point("parse_intent")
        
        return workflow.compile()
    
    async def _parse_intent(self, state: AgentState) -> AgentState:
        """Parse user query to extract intent."""
        today = datetime.now()
        
        prompt = f"""Analyze this user question and extract search intent:

User Question: "{state['query']}"
Current Date: {today.strftime('%Y-%m-%d')}

Extract:
1. date_range: If user mentions time (last week, yesterday, January, etc.), convert to dates
2. tags: Technical keywords to search for (e.g., React, Python, CORS)
3. semantic_query: Core question for semantic search
4. needs_rag: Whether semantic search is needed

Respond in JSON:
{{
    "date_range": {{"start": "YYYY-MM-DD", "end": "YYYY-MM-DD"}} or null,
    "tags": ["tag1", "tag2"] or [],
    "semantic_query": "core search query",
    "needs_rag": true or false
}}

Examples:
- "上周我怎么解决CORS问题的" → date_range: last week, tags: ["CORS"], needs_rag: true
- "最近学了什么React" → date_range: last 7 days, tags: ["React"], needs_rag: false
- "总结一下Python项目经验" → date_range: null, tags: ["Python"], needs_rag: true"""

        try:
            result = await self.llm.generate_json(prompt, temperature=0.3)
            state["intent"] = result
            logger.info(f"[Agent] Parsed intent: {result}")
        except Exception as e:
            logger.error(f"[Agent] Intent parsing failed: {e}")
            state["intent"] = {
                "date_range": None,
                "tags": [],
                "semantic_query": state["query"],
                "needs_rag": True
            }
        
        return state
    
    async def _retrieve_logs(self, state: AgentState) -> AgentState:
        """Multi-path retrieval based on intent."""
        intent = state.get("intent", {})
        results = []
        seen_ids = set()
        
        # 1. Date range filtering (strong)
        if intent.get("date_range"):
            try:
                start = datetime.strptime(intent["date_range"]["start"], "%Y-%m-%d")
                end = datetime.strptime(intent["date_range"]["end"], "%Y-%m-%d")
                # Add 1 day to end to include the end date
                end = end + timedelta(days=1)
                
                date_logs = get_logs_by_date_range(
                    int(start.timestamp() * 1000),
                    int(end.timestamp() * 1000)
                )
                for log in date_logs:
                    if log["id"] not in seen_ids:
                        log["retrieval_score"] = 1.0  # High score for date match
                        results.append(log)
                        seen_ids.add(log["id"])
                logger.info(f"[Agent] Date filter found {len(date_logs)} logs")
            except Exception as e:
                logger.error(f"[Agent] Date filtering failed: {e}")
        
        # 2. Tag filtering (weak - adds to score)
        if intent.get("tags"):
            tag_logs = get_logs_by_tags(intent["tags"])
            for log in tag_logs:
                if log["id"] in seen_ids:
                    # Boost score for existing logs with matching tags
                    for r in results:
                        if r["id"] == log["id"]:
                            r["retrieval_score"] = r.get("retrieval_score", 0) + 0.3
                            break
                else:
                    log["retrieval_score"] = 0.3  # Lower score for tag-only match
                    results.append(log)
                    seen_ids.add(log["id"])
            logger.info(f"[Agent] Tag filter found {len(tag_logs)} logs")
        
        # 3. Semantic search (RAG)
        if intent.get("needs_rag", True):
            try:
                from services.embedding import compute_embedding
                
                query_embedding = await compute_embedding(intent.get("semantic_query", state["query"]))
                log_embeddings = get_log_embeddings()
                
                # Calculate similarity scores
                for log_emb in log_embeddings:
                    sim = cosine_similarity(query_embedding, log_emb["embedding"])
                    if sim > 0.3:  # Threshold
                        if log_emb["id"] in seen_ids:
                            # Boost existing
                            for r in results:
                                if r["id"] == log_emb["id"]:
                                    r["retrieval_score"] = r.get("retrieval_score", 0) + sim * 0.7
                                    break
                        else:
                            results.append({
                                "id": log_emb["id"],
                                "content": log_emb["content"],
                                "timestamp": log_emb["timestamp"],
                                "tags": log_emb["tags"],
                                "retrieval_score": sim * 0.7
                            })
                            seen_ids.add(log_emb["id"])
                
                logger.info(f"[Agent] RAG found matches in {len(log_embeddings)} logs")
            except Exception as e:
                logger.error(f"[Agent] RAG search failed: {e}")
        
        # If no results and no specific filters, get recent logs
        if not results:
            results = get_all_logs(limit=20)
            for log in results:
                log["retrieval_score"] = 0.1
        
        # Sort by score and take top results
        results.sort(key=lambda x: x.get("retrieval_score", 0), reverse=True)
        state["retrieved_logs"] = results[:20]
        
        logger.info(f"[Agent] Total retrieved: {len(state['retrieved_logs'])} logs")
        return state
    
    async def _generate_answer(self, state: AgentState) -> AgentState:
        """Generate answer based on retrieved logs."""
        retrieved = state.get("retrieved_logs", [])
        
        # Format logs for context
        def format_date(ts: int) -> str:
            return datetime.fromtimestamp(ts / 1000).strftime("%Y-%m-%d")
        
        context = "\n".join(
            f"[{format_date(log['timestamp'])}] {log['content']}"
            for log in retrieved[:15]
        )
        
        # Format conversation history
        history = ""
        if state.get("conversation_history"):
            history = "\n\n".join(
                f"{'User' if m['role'] == 'user' else 'Assistant'}: {m['content']}"
                for m in state["conversation_history"][-10:]
            )
            history = f"\n=== CONVERSATION HISTORY ===\n{history}\n"
        
        prompt = f"""You are a helpful AI assistant that knows my work history. Answer based on my work logs when relevant.

=== MY WORK LOGS ===
{context if context else "(No relevant logs found)"}
{history}
=== CURRENT QUESTION ===
{state['query']}

Provide a helpful, conversational response. If relevant information is found in the logs, reference the dates.
Format your response with Markdown when appropriate (code blocks, lists, etc.).
If no relevant logs are found, say so but try to provide general helpful advice."""

        try:
            state["answer"] = await self.llm.generate(prompt)
        except Exception as e:
            logger.error(f"[Agent] Answer generation failed: {e}")
            state["answer"] = f"Sorry, I encountered an error: {e}"
        
        return state
    
    async def run(
        self,
        query: str,
        conversation_history: List[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Run the agent to answer a question.
        
        Args:
            query: User's question
            conversation_history: Previous messages in the conversation
        
        Returns:
            Dict with answer, retrieved_logs, and intent
        """
        initial_state: AgentState = {
            "query": query,
            "conversation_history": conversation_history or [],
            "intent": None,
            "retrieved_logs": [],
            "answer": ""
        }
        
        # Run the graph
        final_state = await self.graph.ainvoke(initial_state)
        
        return {
            "answer": final_state["answer"],
            "retrieved_logs": final_state["retrieved_logs"],
            "intent": final_state["intent"]
        }
