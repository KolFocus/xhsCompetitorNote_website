# 测试脚本说明

## 报告功能API测试

### 前置条件

1. **安装依赖**（如果需要）：
   ```bash
   npm install node-fetch@2 --save-dev
   ```

2. **启动Next.js开发服务器**：
   ```bash
   npm run dev
   ```
   确保服务器运行在 `http://localhost:3000`

### 运行测试

```bash
npm run test:reports
```

或者直接使用node运行：

```bash
node scripts/test-reports-api.js
```

### 测试账号

测试脚本使用以下账号：
- 邮箱: 347319299@qq.com
- 密码: aizan123456

### 测试内容

测试脚本会测试以下API接口：

1. ✅ 用户登录
2. ✅ 计算笔记数量 (`POST /api/reports/calculate-notes`)
3. ✅ 创建报告 (`POST /api/reports`)
4. ✅ 获取报告列表 (`GET /api/reports`)
5. ✅ 获取报告详情 (`GET /api/reports/[id]`)
6. ✅ 计算增量笔记数量 (`POST /api/reports/[id]/calculate-new-notes`)
7. ✅ 获取报告笔记列表 (`GET /api/reports/[id]/notes`)
8. ✅ 批量操作笔记 (`POST /api/reports/[id]/notes/batch-action`)
9. ✅ 追加笔记到报告 (`POST /api/reports/[id]/add-notes`)
10. ⚠️ 删除报告 (`DELETE /api/reports/[id]`) - 默认注释，避免删除测试数据

### 注意事项

- 确保数据库中有测试数据（品牌、笔记等）
- 测试会创建实际的报告，建议在测试环境运行
- 删除报告的测试默认被注释，如需测试请取消注释

