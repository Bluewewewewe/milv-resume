'use client'

import { useState, useRef, useCallback } from 'react'

// ========== 类型定义 ==========
interface AnalysisResult {
  overallScore: number
  dimensions: Record<string, { score: number; label: string; comment: string }>
  strengths: string[]
  weaknesses: string[]
  suggestions: { original: string; improved: string; reason: string }[]
  jdMatch?: number
  summary: string
}

interface User {
  id: string
  email: string
  displayName: string
  plan: string
  remainingQuota: number
}

// ========== 主页面 ==========
export default function Home() {
  // 状态
  const [user, setUser] = useState<User | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [resumeText, setResumeText] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeStep, setAnalyzeStep] = useState(0)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [showLogin, setShowLogin] = useState(false)
  const [showRedeem, setShowRedeem] = useState(false)
  const [loginMode, setLoginMode] = useState<'login' | 'register'>('login')
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [redeemCode, setRedeemCode] = useState('')
  const [toast, setToast] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Toast提示
  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }, [])

  // 文件上传
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    // 读取文件内容
    const text = await f.text()
    setResumeText(text)
    showToast(`已选择: ${f.name}`)
  }

  // 开始分析
  const handleAnalyze = async () => {
    if (!resumeText && !file) {
      showToast('请先上传简历或粘贴简历内容')
      return
    }

    // 未登录先登录
    if (!user) {
      setShowLogin(true)
      return
    }

    setAnalyzing(true)
    setAnalyzeStep(0)
    setResult(null)

    // 模拟5步分析动画
    const steps = [
      { label: '解析简历结构', delay: 800 },
      { label: '提取关键信息', delay: 1200 },
      { label: '匹配岗位需求', delay: 1000 },
      { label: 'AI深度分析', delay: 1500 },
      { label: '生成优化报告', delay: 800 },
    ]

    for (let i = 0; i < steps.length; i++) {
      setAnalyzeStep(i + 1)
      await new Promise(r => setTimeout(r, steps[i].delay))
    }

    // 调后端API
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeText, jobDescription }),
      })
      const data = await res.json()
      setResult(data)
    } catch {
      showToast('分析失败，请重试')
    }

    setAnalyzing(false)
  }

  // 登录/注册（先模拟，接Supabase后替换）
  const handleLogin = async () => {
    // TODO: 接入Supabase Auth
    // 模拟登录成功
    setUser({
      id: 'demo-user-001',
      email: loginEmail || 'demo@milv.ai',
      displayName: loginEmail?.split('@')[0] || '体验用户',
      plan: 'free',
      remainingQuota: 3,
    })
    setShowLogin(false)
    showToast('登录成功！')
  }

  // 兑换码
  const handleRedeem = async () => {
    if (!redeemCode) return
    if (!user) {
      setShowLogin(true)
      setShowRedeem(false)
      return
    }
    try {
      const res = await fetch('/api/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: redeemCode, userId: user.id }),
      })
      const data = await res.json()
      if (data.success) {
        setUser({ ...user, plan: data.plan })
        showToast(data.message)
        setShowRedeem(false)
        setRedeemCode('')
      } else {
        showToast(data.error || '兑换失败')
      }
    } catch {
      showToast('兑换失败，请重试')
    }
  }

  return (
    <div className="min-h-screen">
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] bg-brand text-white px-6 py-3 rounded-lg shadow-lg animate-fade-up text-sm font-medium">
          {toast}
        </div>
      )}

      {/* 导航栏 */}
      <Nav
        user={user}
        onLogin={() => { setShowLogin(true); setLoginMode('login') }}
        onRedeem={() => setShowRedeem(true)}
        onLogout={() => setUser(null)}
      />

      {/* Hero区 */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-block px-4 py-1.5 bg-brand/10 text-brand text-sm rounded-full mb-8 border border-brand/20">
            AI驱动 · 发现你的闪光点
          </span>
          <h1 className="text-5xl md:text-7xl font-black leading-tight mb-6">
            你的经历
            <br />
            <span className="text-brand">比你以为的</span>
            <br />
            <span className="text-text-secondary">更精彩</span>
          </h1>
          <p className="text-text-muted text-lg max-w-xl mx-auto mb-10">
            不只是改格式，而是深度挖掘你的职业经历，把平淡描述变成有说服力的成绩。
          </p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={handleAnalyze}
              className="px-8 py-4 bg-brand hover:bg-brand-dark text-white font-bold rounded-xl transition-all hover:scale-105 flex items-center gap-2"
            >
              ✦ 免费优化简历
            </button>
            <a
              href="#how"
              className="px-8 py-4 bg-surface-card hover:bg-surface-hover text-text-secondary font-medium rounded-xl border border-border transition-all"
            >
              了解流程
            </a>
          </div>
          <div className="flex justify-center gap-12 mt-16 pt-8 border-t border-border max-w-md mx-auto">
            <div className="text-center">
              <div className="text-3xl font-black text-brand">3</div>
              <div className="text-text-muted text-sm mt-1">每月免费次数</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-black text-brand">72</div>
              <div className="text-text-muted text-sm mt-1">简历平均提升分</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-black text-text-muted">¥0</div>
              <div className="text-text-muted text-sm mt-1">起步费用</div>
            </div>
          </div>
        </div>
      </section>

      {/* 功能介绍 */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">不只是改语法，是重新发现你</h2>
          <p className="text-text-muted text-center mb-14">AI从四个维度深度拆解你的简历</p>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { icon: '📝', title: '内容质量', desc: '量化成果、补充关键信息、挖掘隐藏亮点' },
              { icon: '🏗️', title: '结构逻辑', desc: '优化排版逻辑、突出核心优势、调整信息层级' },
              { icon: '🔑', title: '关键词匹配', desc: '对标JD关键词、提升ATS通过率、精准命中招聘需求' },
              { icon: '💬', title: '表达力提升', desc: '动词驱动、STAR法则、从"做了什么"到"做成了什么"' },
            ].map((item) => (
              <div key={item.title} className="p-6 bg-surface-card rounded-2xl border border-border hover:border-brand/40 transition-all group">
                <div className="text-3xl mb-4">{item.icon}</div>
                <h3 className="font-bold text-lg mb-2 group-hover:text-brand transition-colors">{item.title}</h3>
                <p className="text-text-muted text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 三步流程 */}
      <section id="how" className="py-20 px-6 bg-surface-card/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-14">三步，看到不一样的自己</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '01', title: '上传简历', desc: '支持PDF、Word格式，或直接粘贴文本' },
              { step: '02', title: 'AI深度分析', desc: '多维度拆解，对标岗位需求精准匹配' },
              { step: '03', title: '获取优化方案', desc: '逐条建议+改写示例，直接可用' },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="text-5xl font-black text-brand/20 mb-4">{item.step}</div>
                <h3 className="font-bold text-xl mb-3">{item.title}</h3>
                <p className="text-text-muted">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 上传+分析区 */}
      <section id="start" className="py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-10">开始优化</h2>

          {/* 上传区 */}
          <div className="mb-6">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border hover:border-brand/60 rounded-2xl p-10 text-center cursor-pointer transition-all bg-surface-card/50 hover:bg-surface-card"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="text-4xl mb-3">📄</div>
              <p className="text-text-secondary font-medium">
                {file ? file.name : '点击上传简历'}
              </p>
              <p className="text-text-muted text-sm mt-2">支持 PDF、Word、TXT 格式</p>
            </div>
          </div>

          {/* 或者粘贴文本 */}
          <div className="mb-6">
            <label className="text-text-muted text-sm mb-2 block">或直接粘贴简历内容</label>
            <textarea
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              placeholder="将简历文字粘贴到这里..."
              className="w-full h-40 bg-surface-card border border-border rounded-xl p-4 text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-brand/60 resize-none"
            />
          </div>

          {/* JD输入 */}
          <div className="mb-8">
            <label className="text-text-muted text-sm mb-2 block">目标岗位JD（可选，有JD分析更精准）</label>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="粘贴目标岗位的职位描述..."
              className="w-full h-28 bg-surface-card border border-border rounded-xl p-4 text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-brand/60 resize-none"
            />
          </div>

          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="w-full py-4 bg-brand hover:bg-brand-dark disabled:bg-brand/40 text-white font-bold rounded-xl transition-all text-lg"
          >
            {analyzing ? '分析中...' : '✦ 开始AI分析'}
          </button>
        </div>
      </section>

      {/* 分析动画遮罩 */}
      {analyzing && <AnalyzeOverlay step={analyzeStep} />}

      {/* 分析结果 */}
      {result && !analyzing && <AnalysisReport result={result} />}

      {/* 定价 */}
      <section id="pricing" className="py-20 px-6 bg-surface-card/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">简单透明的定价</h2>
          <p className="text-text-muted text-center mb-14">先免费体验，有效果再付费</p>
          <div className="grid md:grid-cols-3 gap-6">
            <PriceCard plan="free" price="¥0" desc="每月3次免费" features={['3次/月AI分析', '基础优化建议', '关键词检查']} current={user?.plan === 'free'} />
            <PriceCard plan="annual" price="¥99" desc="/年" features={['无限次AI分析', '深度优化报告', 'JD精准匹配', '改写示例', '优先客服']} current={user?.plan === 'annual'} highlight />
            <PriceCard plan="lifetime" price="¥199" desc="一次买断" features={['所有年度权益', '永久使用', '新功能优先体验']} current={user?.plan === 'lifetime'} />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-border">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="bg-brand text-white px-2 py-0.5 rounded text-sm font-bold">觅履</span>
            <span className="text-text-muted text-sm">AI简历优化平台</span>
          </div>
          <div className="text-text-muted text-sm">© 2025 觅履 MILV. All rights reserved.</div>
        </div>
      </footer>

      {/* 登录弹窗 */}
      {showLogin && (
        <LoginModal
          mode={loginMode}
          email={loginEmail}
          password={loginPassword}
          setEmail={setLoginEmail}
          setPassword={setLoginPassword}
          setMode={setLoginMode}
          onLogin={handleLogin}
          onClose={() => setShowLogin(false)}
        />
      )}

      {/* 兑换码弹窗 */}
      {showRedeem && (
        <RedeemModal
          code={redeemCode}
          setCode={setRedeemCode}
          onRedeem={handleRedeem}
          onClose={() => setShowRedeem(false)}
        />
      )}
    </div>
  )
}

// ========== 导航栏 ==========
function Nav({ user, onLogin, onRedeem, onLogout }: {
  user: User | null
  onLogin: () => void
  onRedeem: () => void
  onLogout: () => void
}) {
  return (
    <nav className="fixed top-0 w-full bg-surface/80 backdrop-blur-xl border-b border-border z-50">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <span className="bg-brand text-white px-2.5 py-1 rounded-lg text-sm font-bold">觅履</span>
          <div className="hidden md:flex gap-6">
            {['功能', '流程', '开始', '定价'].map(item => (
              <a key={item} href={`#${item === '功能' ? 'features' : item === '流程' ? 'how' : item === '开始' ? 'start' : 'pricing'}`} className="text-text-muted hover:text-text-primary text-sm transition-colors">
                {item}
              </a>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onRedeem} className="px-4 py-2 text-sm text-text-muted hover:text-text-primary border border-border rounded-lg transition-all">
            兑换
          </button>
          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-text-secondary">{user.displayName}</span>
              <button onClick={onLogout} className="text-text-muted hover:text-text-primary text-sm">退出</button>
            </div>
          ) : (
            <button onClick={onLogin} className="px-5 py-2 bg-brand hover:bg-brand-dark text-white text-sm font-medium rounded-lg transition-all">
              登录
            </button>
          )}
        </div>
      </div>
    </nav>
  )
}

// ========== 分析动画遮罩 ==========
function AnalyzeOverlay({ step }: { step: number }) {
  const steps = [
    { icon: '📄', label: '解析简历结构' },
    { icon: '🔍', label: '提取关键信息' },
    { icon: '🎯', label: '匹配岗位需求' },
    { icon: '🧠', label: 'AI深度分析' },
    { icon: '📊', label: '生成优化报告' },
  ]

  return (
    <div className="fixed inset-0 bg-surface/95 backdrop-blur-sm z-40 flex items-center justify-center">
      <div className="text-center">
        <div className="relative w-24 h-24 mx-auto mb-8">
          <div className="absolute inset-0 bg-brand/20 rounded-full animate-pulse-ring" />
          <div className="absolute inset-2 bg-brand/30 rounded-full animate-pulse-ring" style={{ animationDelay: '0.5s' }} />
          <div className="absolute inset-4 bg-brand rounded-full flex items-center justify-center text-3xl">
            {steps[Math.min(step - 1, 4)]?.icon || '✦'}
          </div>
        </div>
        <div className="space-y-3 max-w-xs mx-auto">
          {steps.map((s, i) => (
            <div key={i} className={`flex items-center gap-3 text-sm transition-all duration-500 ${i < step ? 'text-brand' : 'text-text-muted/40'}`}>
              <span className="text-base">{i < step ? '✓' : '○'}</span>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ========== 分析报告 ==========
function AnalysisReport({ result }: { result: AnalysisResult }) {
  return (
    <section className="py-20 px-6">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-10">分析报告</h2>

        {/* 总分 */}
        <div className="text-center mb-12">
          <div className="inline-flex flex-col items-center">
            <div className="text-7xl font-black text-brand animate-fade-up">{result.overallScore}</div>
            <div className="text-text-muted mt-2">综合评分</div>
          </div>
          {result.jdMatch !== undefined && (
            <div className="mt-4">
              <span className="text-sm text-text-muted">JD匹配度: </span>
              <span className="text-brand font-bold">{result.jdMatch}%</span>
            </div>
          )}
        </div>

        {/* 四维评分 */}
        <div className="grid md:grid-cols-4 gap-4 mb-12">
          {Object.entries(result.dimensions).map(([key, dim], i) => (
            <div key={key} className="bg-surface-card rounded-2xl p-5 border border-border animate-fade-up" style={{ animationDelay: `${i * 150}ms` }}>
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm text-text-muted">{dim.label}</span>
                <span className="text-brand font-bold text-lg">{dim.score}</span>
              </div>
              <div className="w-full h-2 bg-border rounded-full overflow-hidden mb-3">
                <div
                  className="h-full bg-brand rounded-full transition-all duration-1000"
                  style={{ width: `${dim.score}%` }}
                />
              </div>
              <p className="text-text-muted text-xs leading-relaxed">{dim.comment}</p>
            </div>
          ))}
        </div>

        {/* 优缺点 */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <div className="bg-surface-card rounded-2xl p-6 border border-border">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">✅ 亮点</h3>
            <ul className="space-y-3">
              {result.strengths.map((s, i) => (
                <li key={i} className="text-text-secondary text-sm leading-relaxed flex gap-2">
                  <span className="text-brand shrink-0">•</span>{s}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-surface-card rounded-2xl p-6 border border-border">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">⚠️ 待改进</h3>
            <ul className="space-y-3">
              {result.weaknesses.map((w, i) => (
                <li key={i} className="text-text-secondary text-sm leading-relaxed flex gap-2">
                  <span className="text-brand shrink-0">•</span>{w}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* 优化建议 */}
        <div className="bg-surface-card rounded-2xl p-6 border border-border mb-8">
          <h3 className="font-bold text-lg mb-6">💡 逐条优化建议</h3>
          <div className="space-y-6">
            {result.suggestions.map((s, i) => (
              <div key={i} className="border-l-2 border-brand pl-5">
                <div className="mb-2">
                  <span className="text-text-muted text-xs">原文</span>
                  <p className="text-red-400/80 text-sm line-through">{s.original}</p>
                </div>
                <div className="mb-2">
                  <span className="text-brand text-xs">优化后</span>
                  <p className="text-green-400 text-sm font-medium">{s.improved}</p>
                </div>
                <p className="text-text-muted text-xs">{s.reason}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 总结 */}
        <div className="bg-brand/5 border border-brand/20 rounded-2xl p-6 text-center">
          <p className="text-text-secondary leading-relaxed">{result.summary}</p>
        </div>
      </div>
    </section>
  )
}

// ========== 定价卡片 ==========
function PriceCard({ plan, price, desc, features, current, highlight }: {
  plan: string; price: string; desc: string; features: string[]; current: boolean; highlight?: boolean
}) {
  return (
    <div className={`rounded-2xl p-6 border transition-all ${highlight ? 'border-brand bg-brand/5 scale-105' : 'border-border bg-surface-card'}`}>
      {highlight && <div className="text-center mb-3"><span className="bg-brand text-white text-xs px-3 py-1 rounded-full font-medium">推荐</span></div>}
      <div className="text-center mb-6">
        <h3 className="font-bold text-lg mb-1 capitalize">{plan === 'free' ? '免费版' : plan === 'annual' ? '年度会员' : '终身会员'}</h3>
        <div className="flex items-baseline justify-center gap-1">
          <span className="text-4xl font-black">{price}</span>
          <span className="text-text-muted text-sm">{desc}</span>
        </div>
      </div>
      <ul className="space-y-3 mb-6">
        {features.map((f) => (
          <li key={f} className="text-text-secondary text-sm flex items-center gap-2">
            <span className="text-brand">✓</span>{f}
          </li>
        ))}
      </ul>
      <button className={`w-full py-3 rounded-xl font-medium text-sm transition-all ${
        current ? 'bg-border text-text-muted cursor-default' :
        highlight ? 'bg-brand hover:bg-brand-dark text-white' :
        'bg-surface-hover hover:bg-border text-text-primary border border-border'
      }`}>
        {current ? '当前方案' : '选择方案'}
      </button>
    </div>
  )
}

// ========== 登录弹窗 ==========
function LoginModal({ mode, email, password, setEmail, setPassword, setMode, onLogin, onClose }: {
  mode: 'login' | 'register'
  email: string; password: string
  setEmail: (v: string) => void; setPassword: (v: string) => void
  setMode: (v: 'login' | 'register') => void
  onLogin: () => void; onClose: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface-card border border-border rounded-2xl p-8 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-6">{mode === 'login' ? '登录觅履' : '注册账号'}</h2>

        <div className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="邮箱地址"
            className="w-full px-4 py-3 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-brand/60"
          />
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="密码"
            className="w-full px-4 py-3 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-brand/60"
          />
          <button onClick={onLogin} className="w-full py-3 bg-brand hover:bg-brand-dark text-white font-medium rounded-xl transition-all">
            {mode === 'login' ? '登录' : '注册'}
          </button>
        </div>

        <div className="my-6 flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-text-muted text-xs">或</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <div className="space-y-3">
          <button className="w-full py-3 bg-surface border border-border rounded-xl text-sm text-text-secondary hover:bg-surface-hover transition-all flex items-center justify-center gap-2">
            🔵 Google 登录
          </button>
          <button className="w-full py-3 bg-surface border border-border rounded-xl text-sm text-text-secondary hover:bg-surface-hover transition-all flex items-center justify-center gap-2">
            🐙 GitHub 登录
          </button>
        </div>

        <p className="text-center text-text-muted text-sm mt-6">
          {mode === 'login' ? '没有账号？' : '已有账号？'}
          <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')} className="text-brand hover:underline ml-1">
            {mode === 'login' ? '注册' : '登录'}
          </button>
        </p>
      </div>
    </div>
  )
}

// ========== 兑换码弹窗 ==========
function RedeemModal({ code, setCode, onRedeem, onClose }: {
  code: string; setCode: (v: string) => void; onRedeem: () => void; onClose: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface-card border border-border rounded-2xl p-8 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-2">兑换码</h2>
        <p className="text-text-muted text-sm mb-6">输入兑换码激活会员权益</p>

        <input
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          placeholder="MILV-XXXX-XXXX"
          className="w-full px-4 py-3 bg-surface border border-border rounded-xl text-sm font-mono tracking-widest focus:outline-none focus:border-brand/60 mb-6 text-center"
        />

        <button onClick={onRedeem} className="w-full py-3 bg-brand hover:bg-brand-dark text-white font-medium rounded-xl transition-all">
          兑换
        </button>

        <p className="text-text-muted text-xs mt-4 text-center">测试码: MILV-TEST-1234</p>
      </div>
    </div>
  )
}
