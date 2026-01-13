#!/bin/bash
# 应用补丁脚本 - 在备份环境使用
# 使用方法: ./scripts/backup-apply.sh <补丁文件路径>

set -e

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 检查参数
if [ -z "$1" ]; then
    echo -e "${RED}错误: 请指定补丁文件路径${NC}"
    echo "使用方法: ./scripts/backup-apply.sh <补丁文件路径>"
    exit 1
fi

PATCH_FILE="$1"
PATCH_DIR=$(dirname "$PATCH_FILE")
PATCH_NAME=$(basename "$PATCH_FILE")
PATCH_HASH_FILE="${PATCH_FILE}.hash"
PATCH_SHA_FILE="${PATCH_FILE}.sha256"
PATCH_STAT_FILE="${PATCH_FILE}.stat"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}应用补丁文件${NC}"
echo -e "${GREEN}补丁文件: $PATCH_FILE${NC}"
echo -e "${GREEN}========================================${NC}"

# 检查补丁文件是否存在
if [ ! -f "$PATCH_FILE" ]; then
    echo -e "${RED}错误: 补丁文件不存在: $PATCH_FILE${NC}"
    exit 1
fi

# 检查是否在git仓库中
if [ ! -d ".git" ]; then
    echo -e "${RED}错误: 当前目录不是Git仓库${NC}"
    exit 1
fi

echo -e "${YELLOW}步骤 1: 验证补丁文件完整性...${NC}"
if [ -f "$PATCH_SHA_FILE" ]; then
    cd "$PATCH_DIR"
    # 使用 --status 模式，只返回退出码，避免路径问题
    if sha256sum --status -c "$PATCH_SHA_FILE" 2>/dev/null; then
        echo -e "${GREEN}校验和验证通过${NC}"
    else
        echo -e "${RED}错误: 校验和验证失败，文件可能损坏${NC}"
        echo "校验文件: $PATCH_SHA_FILE"
        exit 1
    fi
    cd - > /dev/null
else
    echo -e "${YELLOW}警告: 未找到校验和文件，跳过验证${NC}"
fi

echo -e "${YELLOW}步骤 2: 显示补丁统计信息...${NC}"
if [ -f "$PATCH_STAT_FILE" ]; then
    cat "$PATCH_STAT_FILE"
fi

echo -e "${YELLOW}步骤 3: 应用补丁到工作区...${NC}"
if git apply --3way < "$PATCH_FILE"; then
    echo -e "${GREEN}补丁应用成功${NC}"
else
    echo -e "${RED}错误: 补丁应用失败${NC}"
    echo "请检查并解决冲突"
    exit 1
fi

echo -e "${YELLOW}步骤 4: 将更改暂存（排除补丁文件）...${NC}"
git add -- "$PATCH_DIR"
git reset HEAD -- "$PATCH_FILE" "$PATCH_SHA_FILE" "$PATCH_STAT_FILE" "$PATCH_HASH_FILE" 2>/dev/null || true

echo -e "${YELLOW}步骤 5: 显示变更统计...${NC}"
git diff --cached --stat

echo -e "${YELLOW}步骤 6: 清理补丁文件...${NC}"
rm -f "$PATCH_FILE" "$PATCH_SHA_FILE" "$PATCH_STAT_FILE" "$PATCH_HASH_FILE"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}补丁应用完成！${NC}"
echo -e "${GREEN}更改已暂存，请自行提交${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}下一步操作:${NC}"
echo "git commit -m 'Backup: <时间>'"