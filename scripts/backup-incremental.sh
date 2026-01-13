#!/bin/bash
# 增量备份脚本 - 生成补丁文件
# 使用方法: ./scripts/backup-incremental.sh <上次备份的commit哈希>

set -e

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")

# 检查参数或读取最新的同步tag
if [ -z "$1" ]; then
    LAST_SYNC_TAG=$(git tag -l "sync-*" --sort=-creatordate | head -1)
    if [ -n "$LAST_SYNC_TAG" ]; then
        LAST_BACKUP_HASH=$(git rev-parse "$LAST_SYNC_TAG")
        echo -e "${YELLOW}从 $LAST_SYNC_TAG tag读取上次备份: $LAST_BACKUP_HASH${NC}"
    else
        echo -e "${RED}错误: 未找到sync-* tag${NC}"
        echo "使用方法: ./scripts/backup-incremental.sh <上次备份的commit哈希>"
        echo "或者确保至少有一个sync-* tag存在"
        exit 1
    fi
else
    LAST_BACKUP_HASH="$1"
fi
PATCH_NAME="playwright-incremental-${TIMESTAMP}.patch"
PATCH_PATH="${SOURCE_DIR}/${PATCH_NAME}"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}增量备份 - 生成补丁文件${NC}"
echo -e "${GREEN}源目录: $SOURCE_DIR${NC}"
echo -e "${GREEN}上次备份: $LAST_BACKUP_HASH${NC}"
echo -e "${GREEN}补丁文件: $PATCH_PATH${NC}"
echo -e "${GREEN}========================================${NC}"

echo -e "${YELLOW}步骤 1: 生成git补丁...${NC}"
cd "$SOURCE_DIR"

# 生成从上次备份到当前HEAD的补丁
git format-patch --stdout "$LAST_BACKUP_HASH..HEAD" > "$PATCH_PATH"

# 检查补丁是否为空（没有变化）
if [ ! -s "$PATCH_PATH" ]; then
    echo -e "${YELLOW}警告: 没有检测到变化，补丁文件为空${NC}"
    rm "$PATCH_PATH"
    echo "无需备份，代码未发生变化"
    exit 0
fi

echo -e "${YELLOW}步骤 2: 生成补丁摘要...${NC}"
# 生成补丁统计信息
git diff --stat "$LAST_BACKUP_HASH..HEAD" > "${PATCH_PATH}.stat"

# 生成当前commit信息
CURRENT_HASH=$(git rev-parse HEAD)
echo "$CURRENT_HASH" > "${PATCH_PATH}.hash"

echo -e "${YELLOW}步骤 3: 生成文件校验和...${NC}"
# 使用相对路径生成校验和，避免 Windows Git Bash 路径问题
cd "$SOURCE_DIR"
sha256sum "$PATCH_NAME" > "${PATCH_NAME}.sha256"

PATCH_SIZE=$(du -h "$PATCH_PATH" | cut -f1)
COMMIT_COUNT=$(git rev-list --count "$LAST_BACKUP_HASH..HEAD")

# 创建新的同步tag
SYNC_TAG="sync-$(date +"%Y%m%d-%H%M%S")"
git tag "$SYNC_TAG" "$CURRENT_HASH"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}增量备份完成！${NC}"
echo -e "${GREEN}补丁文件: $PATCH_PATH${NC}"
echo -e "${GREEN}文件大小: $PATCH_SIZE${NC}"
echo -e "${GREEN}包含提交数: $COMMIT_COUNT${NC}"
echo -e "${GREEN}当前commit: $CURRENT_HASH${NC}"
echo -e "${GREEN}同步tag已创建: $SYNC_TAG${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}下一步操作:${NC}"
echo "1. 将以下文件拷贝到备份环境:"
echo "   - $PATCH_NAME"
echo "   - ${PATCH_NAME}.sha256"
echo "   - ${PATCH_NAME}.stat"
echo "   - ${PATCH_NAME}.hash"
echo "2. 在备份环境运行应用补丁脚本"
echo "3. 下次增量备份时，脚本会自动读取最新的sync-* tag"
