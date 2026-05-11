"""
鼻纹智救 - AI推理服务
FastAPI 入口，参考 dog-nose-print 结构
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from api import detect, extract, compare

app = FastAPI(title="鼻纹智救 AI服务", version="0.1.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(detect.router, prefix="/detect", tags=["活体检测"])
app.include_router(extract.router, prefix="/extract", tags=["特征提取"])
app.include_router(compare.router, prefix="/compare", tags=["向量比对"])


@app.get("/")
async def welcome():
    return {"message": "鼻纹智救 AI服务", "version": "0.1.0"}


@app.get("/health")
async def health_check():
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run("src.main:app", host="0.0.0.0", port=8000, reload=True)
