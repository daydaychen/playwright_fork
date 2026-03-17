#!/bin/bash

# 如果运行在测试环境, 添加外网路由
if [ "${RUN_MODE}" == "test" ]; then
  route add default gw 10.204.16.243
fi

exec "$@"
