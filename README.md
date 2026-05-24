# 觅履 MILV — AI简历优化平台

AI驱动的简历深度优化工具，不只是改格式，而是发现你的闪光点。

## 技术栈

- **前端**: Next.js 15 + React 19 + Tailwind CSS 4
- **后端**: Next.js API Routes
- **数据库**: Supabase (PostgreSQL + Auth)
- **AI**: Coze Bot API / OpenAI API
- **支付**: 面包多 Webhook

## 功能

- ✅ AI四维深度分析（内容质量/结构逻辑/关键词匹配/表达力）
- ✅ JD精准匹配度评估
- ✅ 逐条优化建议 + 改写示例
- ✅ 邮箱/Google/GitHub 登录
- ✅ 兑换码系统（MILV-XXXX-XXXX）
- ✅ 面包多支付回调
- ✅ 会员管理（免费/年度/终身）

## 快速开始

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.local.example .env.local
# 编辑 .env.local 填入你的 Supabase 和 AI API 配置

# 开发模式
npm run dev

# 生产构建
npm run build && npm start
```

## 数据库配置

1. 注册 [Supabase](https://supabase.com)，创建项目
2. 在 SQL Editor 中运行 `supabase-schema.sql`
3. 将连接信息填入 `.env.local`

## 部署

推荐使用 [Zeabur](https://zeabur.com)（香港节点，国内访问快，无需备案）

## 项目结构

```
src/
├── app/
│   ├── page.tsx              # 主页面
│   ├── layout.tsx            # 根布局
│   ├── globals.css           # 全局样式
│   └── api/
│       ├── analyze/route.ts  # AI分析接口
│       ├── redeem/route.ts   # 兑换码接口
│       ├── membership/route.ts # 会员查询
│       └── payment/webhook/  # 支付回调
├── lib/
│   └── supabase.ts           # Supabase客户端
supabase-schema.sql           # 数据库建表脚本
```

## License

MIT
