"""
Embedding Router
API endpoints for embedding operations
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
import logging

from services.embedding import (
    compute_embedding,
    compute_batch_embeddings,
    cosine_similarity,
    compute_similarity_matrix,
    estimate_tokens
)

logger = logging.getLogger(__name__)
router = APIRouter()


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


@router.post("", response_model=EmbedResponse)
async def embed_text(request: EmbedRequest):
    """Compute embedding for a single text."""
    try:
        embedding = await compute_embedding(request.text)
        return EmbedResponse(
            embedding=embedding,
            chunks=1,  # Simplified, could track actual chunks
            tokens_estimated=estimate_tokens(request.text)
        )
    except Exception as e:
        logger.error(f"Embedding error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/batch", response_model=BatchEmbedResponse)
async def embed_batch(request: BatchEmbedRequest):
    """Compute embeddings for multiple texts."""
    try:
        embeddings = await compute_batch_embeddings(request.texts)
        return BatchEmbedResponse(
            embeddings=embeddings,
            total_chunks=len(request.texts)
        )
    except Exception as e:
        logger.error(f"Batch embedding error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/similarity", response_model=SimilarityResponse)
async def compute_sim(request: SimilarityRequest):
    """Compute cosine similarity between two embeddings."""
    try:
        similarity = cosine_similarity(request.embedding1, request.embedding2)
        return SimilarityResponse(similarity=similarity)
    except Exception as e:
        logger.error(f"Similarity error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/similarity/matrix", response_model=SimilarityMatrixResponse)
async def compute_sim_matrix(request: SimilarityMatrixRequest):
    """Compute pairwise similarity matrix."""
    try:
        matrix = compute_similarity_matrix(request.embeddings)
        return SimilarityMatrixResponse(matrix=matrix)
    except Exception as e:
        logger.error(f"Similarity matrix error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
