#!/bin/bash
# 首次备份脚本 - 生成完整的代码归档
# 使用方法: ./scripts/backup-first.sh

set -e

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
ARCHIVE_NAME="playwright-first-backup-${TIMESTAMP}.tar.gz"
ARCHIVE_PATH="${SOURCE_DIR}/${ARCHIVE_NAME}"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}首次备份 - 生成完整归档${NC}"
echo -e "${GREEN}源目录: $SOURCE_DIR${NC}"
echo -e "${GREEN}归档文件: $ARCHIVE_PATH${NC}"
echo -e "${GREEN}========================================${NC}"

echo -e "${YELLOW}步骤 1: 创建归档文件...${NC}"
cd "$SOURCE_DIR"

# 创建tar.gz归档，排除不必要的文件
tar -czf "$ARCHIVE_PATH" \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='.next' \
    --exclude='dist' \
    --exclude='build' \
    --exclude='coverage' \
    --exclude='.turbo' \
    --exclude='.env*' \
    --exclude='*.log' \
    --exclude='*.tar.gz' \
    .

echo -e "${YELLOW}步骤 2: 生成文件校验和...${NC}"
cd "$SOURCE_DIR"
sha256sum "$ARCHIVE_NAME" > "${ARCHIVE_NAME}.sha256"

ARCHIVE_SIZE=$(du -h "$ARCHIVE_PATH" | cut -f1)

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}首次备份完成！${NC}"
echo -e "${GREEN}归档文件: $ARCHIVE_PATH${NC}"
echo -e "${GREEN}文件大小: $ARCHIVE_SIZE${NC}"
echo -e "${GREEN}校验和文件: ${ARCHIVE_PATH}.sha256${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}下一步操作:${NC}"
echo "1. 将 $ARCHIVE_NAME 和 ${ARCHIVE_NAME}.sha256 拷贝到备份环境"
echo "2. 在备份环境运行: tar -xzf $ARCHIVE_NAME"
echo "3. 初始化Git仓库并提交: git init && git add . && git commit -m 'Initial backup'"
echo "4. 在源端创建同步tag: git tag sync-$(date +"%Y%m%d-%H%M%S")"
