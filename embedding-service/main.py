"""
BGE-M3 Embedding Service
FastAPI microservice for computing text embeddings using BGE-M3 model.
Supports chunking for long texts (>8192 tokens) with overlap and mean pooling.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import numpy as np
import logging
import time

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="BGE-M3 Embedding Service",
    description="Compute text embeddings for Log Knowledge Graph",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
MAX_TOKENS = 8192
CHUNK_OVERLAP = 128
MODEL_NAME = "BAAI/bge-m3"

# Global model (lazy loaded)
model = None

def get_model():
    """Lazy load the BGE-M3 model."""
    global model
    if model is None:
        logger.info(f"Loading model: {MODEL_NAME}")
        start = time.time()
        from sentence_transformers import SentenceTransformer
        model = SentenceTransformer(MODEL_NAME)
        logger.info(f"Model loaded in {time.time() - start:.2f}s")
    return model

def estimate_tokens(text: str) -> int:
    """Estimate token count (rough: ~4 chars per token for Chinese/English mix)."""
    return len(text) // 3

def chunk_text(text: str, max_tokens: int = MAX_TOKENS, overlap: int = CHUNK_OVERLAP) -> List[str]:
    """
    Split text into chunks with overlap.
    Uses sentence-based splitting when possible, falls back to character-based.
    """
    estimated_tokens = estimate_tokens(text)
    
    if estimated_tokens <= max_tokens:
        return [text]
    
    # Character limit (rough conversion from tokens)
    max_chars = max_tokens * 3
    overlap_chars = overlap * 3
    
    chunks = []
    
    # Try to split by paragraphs first
    paragraphs = text.split('\n\n')
    current_chunk = ""
    
    for para in paragraphs:
        if len(current_chunk) + len(para) + 2 <= max_chars:
            current_chunk += ("\n\n" if current_chunk else "") + para
        else:
            if current_chunk:
                chunks.append(current_chunk)
            # If single paragraph is too long, split by sentences
            if len(para) > max_chars:
                sentences = para.replace('。', '。\n').replace('. ', '.\n').split('\n')
                current_chunk = ""
                for sent in sentences:
                    if len(current_chunk) + len(sent) + 1 <= max_chars:
                        current_chunk += (" " if current_chunk else "") + sent
                    else:
                        if current_chunk:
                            chunks.append(current_chunk)
                        # If single sentence is still too long, force split
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
            # Prepend last overlap_chars from previous chunk
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

def cosine_similarity(vec1: np.ndarray, vec2: np.ndarray) -> float:
    """Compute cosine similarity between two vectors."""
    dot = np.dot(vec1, vec2)
    norm1 = np.linalg.norm(vec1)
    norm2 = np.linalg.norm(vec2)
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return float(dot / (norm1 * norm2))


# Request/Response Models
class EmbedRequest(BaseModel):
    text: str

class EmbedResponse(BaseModel):
    embedding: List[float]
    chunks: int
    tokens_estimated: int

class BatchEmbedRequest(BaseModel):
    texts: List[str]

class BatchEmbedResponse(BaseModel):
    embeddings: List[List[float]]
    total_chunks: int

class SimilarityRequest(BaseModel):
    embedding1: List[float]
    embedding2: List[float]

class SimilarityResponse(BaseModel):
    similarity: float

class SimilarityMatrixRequest(BaseModel):
    embeddings: List[List[float]]

class SimilarityMatrixResponse(BaseModel):
    matrix: List[List[float]]


# API Endpoints
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "ok",
        "model": MODEL_NAME,
        "model_loaded": model is not None,
        "max_tokens": MAX_TOKENS
    }

@app.post("/embed", response_model=EmbedResponse)
async def compute_embedding(request: EmbedRequest):
    """Compute embedding for a single text. Handles chunking automatically."""
    try:
        m = get_model()
        
        # Chunk text if needed
        chunks = chunk_text(request.text)
        
        # Compute embeddings for all chunks
        chunk_embeddings = [m.encode(chunk) for chunk in chunks]
        
        # Mean pooling
        final_embedding = mean_pooling(chunk_embeddings)
        
        return EmbedResponse(
            embedding=final_embedding.tolist(),
            chunks=len(chunks),
            tokens_estimated=estimate_tokens(request.text)
        )
    except Exception as e:
        logger.error(f"Embedding error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/embed/batch", response_model=BatchEmbedResponse)
async def compute_batch_embeddings(request: BatchEmbedRequest):
    """Compute embeddings for multiple texts."""
    try:
        m = get_model()
        
        embeddings = []
        total_chunks = 0
        
        for text in request.texts:
            chunks = chunk_text(text)
            total_chunks += len(chunks)
            chunk_embeddings = [m.encode(chunk) for chunk in chunks]
            final_embedding = mean_pooling(chunk_embeddings)
            embeddings.append(final_embedding.tolist())
        
        return BatchEmbedResponse(
            embeddings=embeddings,
            total_chunks=total_chunks
        )
    except Exception as e:
        logger.error(f"Batch embedding error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/similarity", response_model=SimilarityResponse)
async def compute_similarity(request: SimilarityRequest):
    """Compute cosine similarity between two embeddings."""
    try:
        vec1 = np.array(request.embedding1)
        vec2 = np.array(request.embedding2)
        similarity = cosine_similarity(vec1, vec2)
        return SimilarityResponse(similarity=similarity)
    except Exception as e:
        logger.error(f"Similarity error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/similarity/matrix", response_model=SimilarityMatrixResponse)
async def compute_similarity_matrix(request: SimilarityMatrixRequest):
    """Compute pairwise similarity matrix for a list of embeddings."""
    try:
        embeddings = [np.array(e) for e in request.embeddings]
        n = len(embeddings)
        matrix = [[0.0] * n for _ in range(n)]
        
        for i in range(n):
            for j in range(i, n):
                sim = cosine_similarity(embeddings[i], embeddings[j])
                matrix[i][j] = sim
                matrix[j][i] = sim
        
        return SimilarityMatrixResponse(matrix=matrix)
    except Exception as e:
        logger.error(f"Similarity matrix error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5001)
