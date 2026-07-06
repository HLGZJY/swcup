"""FastAPI entry point for AI inference service."""

import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import detect, extract, compare, breed
from contextlib import asynccontextmanager

# Combine both lifespans
async def combined_lifespan(app: FastAPI):
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, extract._load_nose_model)
    await loop.run_in_executor(None, breed._load_breed_model)
    yield

app = FastAPI(
    title="鼻纹智救 - AI 推理服务",
    description="ResNet50 512维向量特征提取 + 活体检测",
    version="0.2.0",
    lifespan=combined_lifespan,
)

# CORS for local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(detect.router)
app.include_router(extract.router)
app.include_router(compare.router)
app.include_router(breed.router)


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok", "service": "ai-service"}


@app.get("/")
async def root():
    return {"message": "鼻纹智救 AI 服务运行中", "docs": "/docs"}
