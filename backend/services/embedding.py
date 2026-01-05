"""
Embedding Service
Moved from main.py for better organization
"""

import logging
import time
from typing import List
import numpy as np

from config.settings import EMBEDDING_MODEL, MAX_TOKENS, CHUNK_OVERLAP

logger = logging.getLogger(__name__)

# Global model (lazy loaded)
_model = None


def get_model():
    """Lazy load the BGE-M3 model."""
    global _model
    if _model is None:
        logger.info(f"Loading model: {EMBEDDING_MODEL}")
        start = time.time()
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer(EMBEDDING_MODEL)
        logger.info(f"Model loaded in {time.time() - start:.2f}s")
    return _model


def estimate_tokens(text: str) -> int:
    """Estimate token count (rough: ~3 chars per token for Chinese/English mix)."""
    return len(text) // 3


def chunk_text(text: str, max_tokens: int = MAX_TOKENS, overlap: int = CHUNK_OVERLAP) -> List[str]:
    """Split text into chunks with overlap."""
    estimated_tokens = estimate_tokens(text)
    
    if estimated_tokens <= max_tokens:
        return [text]
    
    max_chars = max_tokens * 3
    overlap_chars = overlap * 3
    
    chunks = []
    paragraphs = text.split('\n\n')
    current_chunk = ""
    
    for para in paragraphs:
        if len(current_chunk) + len(para) + 2 <= max_chars:
            current_chunk += ("\n\n" if current_chunk else "") + para
        else:
            if current_chunk:
                chunks.append(current_chunk)
            if len(para) > max_chars:
                sentences = para.replace('。', '。\n').replace('. ', '.\n').split('\n')
                current_chunk = ""
                for sent in sentences:
                    if len(current_chunk) + len(sent) + 1 <= max_chars:
                        current_chunk += (" " if current_chunk else "") + sent
                    else:
                        if current_chunk:
                            chunks.append(current_chunk)
                        if len(sent) > max_chars:
                            for i in range(0, len(sent), max_chars - overlap_chars):
                                chunks.append(sent[i:i + max_chars])
                            current_chunk = ""
                        else:
                            current_chunk = sent
            else:
                current_chunk = para
    
    if current_chunk:
        chunks.append(current_chunk)
    
    # Add overlap between chunks
    if len(chunks) > 1 and overlap_chars > 0:
        overlapped_chunks = [chunks[0]]
        for i in range(1, len(chunks)):
            prev_tail = chunks[i-1][-overlap_chars:] if len(chunks[i-1]) > overlap_chars else chunks[i-1]
            overlapped_chunks.append(prev_tail + " " + chunks[i])
        chunks = overlapped_chunks
    
    logger.info(f"Text chunked into {len(chunks)} parts")
    return chunks


def mean_pooling(embeddings: List[np.ndarray]) -> np.ndarray:
    """Average multiple embeddings into one."""
    if len(embeddings) == 1:
        return embeddings[0]
    return np.mean(embeddings, axis=0)


async def compute_embedding(text: str) -> List[float]:
    """Compute embedding for text, handling chunking automatically."""
    model = get_model()
    chunks = chunk_text(text)
    chunk_embeddings = [model.encode(chunk) for chunk in chunks]
    final_embedding = mean_pooling(chunk_embeddings)
    return final_embedding.tolist()


async def compute_batch_embeddings(texts: List[str]) -> List[List[float]]:
    """Compute embeddings for multiple texts."""
    model = get_model()
    embeddings = []
    
    for text in texts:
        chunks = chunk_text(text)
        chunk_embeddings = [model.encode(chunk) for chunk in chunks]
        final_embedding = mean_pooling(chunk_embeddings)
        embeddings.append(final_embedding.tolist())
    
    return embeddings


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


def compute_similarity_matrix(embeddings: List[List[float]]) -> List[List[float]]:
    """Compute pairwise similarity matrix."""
    n = len(embeddings)
    matrix = [[0.0] * n for _ in range(n)]
    
    for i in range(n):
        for j in range(i, n):
            sim = cosine_similarity(embeddings[i], embeddings[j])
            matrix[i][j] = sim
            matrix[j][i] = sim
    
    return matrix
