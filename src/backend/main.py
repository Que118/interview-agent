"""智能面试评估系统 — FastAPI 入口"""
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from core.config import settings
from api.chat import router as chat_router

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="基于多模态 Agent 的智能面试评估系统",
)

# CORS — 允许前端跨域
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 挂载 Mockup 静态页面
import os
mockup_path = r"D:\qjy\workplace\project_002_多模态Agent智能面试评估系统\outputs\mockup"
if os.path.exists(mockup_path):
    app.mount("/demo", StaticFiles(directory=mockup_path, html=True), name="demo")

# 注册路由
app.include_router(chat_router)


@app.get("/")
async def root():
    return {
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True,
    )
