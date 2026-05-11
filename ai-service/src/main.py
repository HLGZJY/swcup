"""FastAPI entry point for AI inference service."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import detect, extract, compare

app = FastAPI(
    title="鼻纹智救 - AI 推理服务",
    description="MobileNetV2 128维向量特征提取 + 活体检测",
    version="0.1.0",
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


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok", "service": "ai-service"}


@app.get("/")
async def root():
    return {"message": "鼻纹智救 AI 服务运行中", "docs": "/docs"}
