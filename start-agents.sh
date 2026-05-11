#!/bin/bash
# 鼻纹智救 — 四智能体协作启动脚本

echo "============================================"
echo "  鼻纹智救 — 四智能体协作系统"
echo "  项目: 第十五届中国软件杯 AI流浪动物防重复救助"
echo "============================================"
echo ""
echo "四个智能体:"
echo "  [1] 统筹 Orchestrator  (hermes -p swcup2026-orchestrator)"
echo "  [2] AI模型 AI-Model     (hermes -p swcup2026-ai-model)"
echo "  [3] 后端  Backend       (hermes -p swcup2026-backend)"
echo "  [4] 前端  Frontend      (hermes -p swcup2026-frontend)"
echo ""
echo "Git 分支对应:"
echo "  Orchestrator → main (统筹，不直接写代码)"
echo "  AI-Model     → feature/ai-model"
echo "  Backend      → feature/backend"
echo "  Frontend     → feature/miniapp"
echo ""
echo "项目路径: /mnt/f/swcup2026/"
echo ""

read -p "选择智能体 [1-4, q退出]: " choice

case $choice in
  1) echo "启动统筹协调者..."; hermes -p swcup2026-orchestrator ;;
  2) echo "启动AI模型专家..."; hermes -p swcup2026-ai-model ;;
  3) echo "启动后端专家..."; hermes -p swcup2026-backend ;;
  4) echo "启动前端专家..."; hermes -p swcup2026-frontend ;;
  q|Q) echo "退出"; exit 0 ;;
  *) echo "无效选择"; exit 1 ;;
esac
