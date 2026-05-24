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
  const [user, setUser] = useState<User | null>(null)
  const [fileName, setFileName] = useState('')
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
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }, [])

  // 文件上传（走后端解析）
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return

    // 文件大小检查（10MB上限）
    if (f.size > 10 * 1024 * 1024) {
      showToast('文件太大，请上传10MB以内的文件')
      return
    }

    setUploading(true)
    setFileName(f.name)

    try {
      const formData = new FormData()
      formData.append('file', f)

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        showToast(data.error || '文件解析失败')
        setFileName('')
        return
      }

      setResumeText(data.text)
      showToast(`解析成功: ${data.fileName} (${data.charCount}字)`)
    } catch {
      showToast('文件上传失败，请重试')
      setFileName('')
    } finally {
      setUploading(false)
    }
  }

  // 开始分析（异步队列模式）
  const handleAnalyze = async () => {
    if (!resumeText) {
      showToast('请先上传简历或粘贴简历内容')
      return
    }

    if (!user) {
      setShowLogin(true)
      return
    }

    setAnalyzing(true)
    setAnalyzeStep(0)
    setResult(null)

    try {
      // 1. 提交分析请求
      const submitRes = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeText,
          jobDescription,
          userId: user.id,
        }),
      })

      const submitData = await submitRes.json()

      if (!submitRes.ok) {
        showToast(submitData.error || '分析提交失败')
        setAnalyzing(false)
        return
      }

      const jobId = submitData.id

      // 2. 播放分析动画
      const steps = [
        { label: '提交分析请求', delay: 600 },
        { label: '解析简历结构', delay: 1000 },
        { label: '提取关键信息', delay: 1200 },
        { label: 'AI深度分析', delay: 1500 },
        { label: '生成优化报告', delay: 800 },
      ]

      for (let i = 0; i < steps.length; i++) {
        setAnalyzeStep(i + 1)
        await new Promise(r => setTimeout(r, steps[i].delay))
      }

      // 3. 轮询结果
      let attempts = 0
      const maxAttempts = 30 // 最多等30秒

      while (attempts < maxAttempts) {
        const statusRes = await fetch(`/api/analyze-status?id=${jobId}`)
        const statusData = await statusRes.json()

        if (statusData.status === 'completed') {
          setResult(statusData.result as AnalysisResult)
          setAnalyzing(false)
          return
        }

        if (statusData.status === 'failed') {
          showToast('分析失败，请重试')
          setAnalyzing(false)
          return
        }

        // pending/processing → 继续等
        attempts++
        await new Promise(r => setTimeout(r, 1000))
      }

      // 超时
      showToast('分析时间较长，请稍后查看结果')
      setAnalyzing(false)

    } catch {
      showToast('分析失败，请重试')
      setAnalyzing(false)
    }
  }

  // 登录
  const handleLogin = async () => {
    // TODO: 接入Supabase Auth
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
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] bg-brand text-white px-6 py-3 rounded-lg shadow-lg animate-fade-up text-sm font-medium">
          {toast}
        </div>
      )}

      <Nav user={user} onLogin={() => { setShowLogin(true); setLoginMode('login') }} onRedeem={() => setShowRedeem(true)} onLogout={() => setUser(null)} />

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-block px-4 py-1.5 bg-brand/10 text-brand text-sm rounded-full mb-8 border border-brand/20">
            发现你的闪光点
          </span>
          <h1 className="text-5xl md:text-7xl font-black leading-tight mb-6">
            你的经历<br /><span className="text-brand">比你以为的</span><br /><span className="text-text-secondary">更精彩</span>
          </h1>
          <p className="text-text-muted text-lg max-w-xl mx-auto mb-4">
            别人帮你调格式，我们帮你重新发现经历的价值。
          </p>
          <p className="text-text-muted/60 text-sm max-w-md mx-auto mb-10">
            AI深度拆解你的每一段经历，把"做了什么"变成"做成了什么"。
          </p>
          <div className="flex gap-4 justify-center">
            <button onClick={handleAnalyze} className="px-8 py-4 bg-brand hover:bg-brand-dark text-white font-bold rounded-xl transition-all hover:scale-105 flex items-center gap-2">
              ✦ 免费优化简历
            </button>
            <a href="#how" className="px-8 py-4 bg-surface-card hover:bg-surface-hover text-text-secondary font-medium rounded-xl border border-border transition-all">
              了解流程
            </a>
          </div>
          <div className="flex justify-center gap-12 mt-16 pt-8 border-t border-border max-w-lg mx-auto">
            <div className="text-center"><div className="text-3xl font-black text-brand">2</div><div className="text-text-muted text-sm mt-1">免费体验次数</div></div>
            <div className="text-center"><div className="text-3xl font-black text-brand">72</div><div className="text-text-muted text-sm mt-1">简历平均提升分</div></div>
            <div className="text-center"><div className="text-3xl font-black text-brand">¥9.9</div><div className="text-text-muted text-sm mt-1">首周特惠</div></div>
          </div>
          <p className="text-center text-text-muted/50 text-xs mt-4">· 次数不累计，到期自动归零 ·</p>
        </div>
      </section>

      {/* 功能 */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">不只调格式，更重写内容</h2>
          <p className="text-text-muted text-center mb-14">排版是面子，内容是里子。我们两个都管。</p>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { icon: '📐', title: '结构优化', desc: '排版逻辑、信息层级、视觉重点，该有的都有' },
              { icon: '🔍', title: '深度拆解', desc: '重新审视每段经历的表达方式，发现你没注意到的价值' },
              { icon: '🎯', title: '精准对标', desc: '对照目标岗位，让你的简历讲HR想听的话' },
              { icon: '✍️', title: '逐条改写', desc: '不只是建议，是直接把更好的写法交到你手上' },
            ].map((item) => (
              <div key={item.title} className="p-6 bg-surface-card rounded-2xl border border-border hover:border-brand/40 transition-all group">
                <div className="text-3xl mb-4">{item.icon}</div>
                <h3 className="font-bold text-lg mb-2 group-hover:text-brand transition-colors">{item.title}</h3>
                <p className="text-text-muted text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
          {/* 差异对比 */}
          <div className="mt-14 bg-surface-card rounded-2xl border border-border overflow-hidden">
            <div className="grid grid-cols-3 text-center border-b border-border">
              <div className="py-4 px-4 text-text-muted text-sm font-medium">对比项</div>
              <div className="py-4 px-4 text-text-muted text-sm font-medium">传统简历工具</div>
              <div className="py-4 px-4 text-brand text-sm font-bold">觅履</div>
            </div>
            {[
              ['排版格式优化', '✅', '✅'],
              ['错别字检查', '✅', '✅'],
              ['AI重写经历描述', '❌', '✅'],
              ['量化隐藏成果', '❌', '✅'],
              ['对标JD关键词', '❌', '✅'],
              ['逐条改写示例', '❌', '✅'],
            ].map(([label, old, neu], i) => (
              <div key={i} className={`grid grid-cols-3 text-center text-sm ${i % 2 === 0 ? 'bg-surface-card' : 'bg-surface-hover/30'}`}>
                <div className="py-3.5 px-4 text-text-secondary font-medium">{label}</div>
                <div className="py-3.5 px-4 text-text-muted">{old}</div>
                <div className="py-3.5 px-4 text-text-primary font-medium">{neu}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 流程 */}
      <section id="how" className="py-20 px-6 bg-surface-card/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-14">三步，看到不一样的自己</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '01', title: '上传简历', desc: '支持PDF、Word格式，AI自动解析提取' },
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

      {/* 上传+分析 */}
      <section id="start" className="py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-10">开始优化</h2>

          <div className="mb-6">
            <div
              onClick={() => !uploading && fileInputRef.current?.click()}
              className={`border-2 border-dashed border-border hover:border-brand/60 rounded-2xl p-10 text-center cursor-pointer transition-all bg-surface-card/50 hover:bg-surface-card ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.txt,.md" onChange={handleFileUpload} className="hidden" />
              <div className="text-4xl mb-3">{uploading ? '⏳' : '📄'}</div>
              <p className="text-text-secondary font-medium">
                {uploading ? '正在解析文件...' : fileName ? `✅ ${fileName}` : '点击上传简历'}
              </p>
              <p className="text-text-muted text-sm mt-2">支持 PDF、Word(.docx)、TXT · 最大10MB</p>
            </div>
          </div>

          <div className="mb-6">
            <label className="text-text-muted text-sm mb-2 block">或直接粘贴简历内容</label>
            <textarea value={resumeText} onChange={(e) => setResumeText(e.target.value)} placeholder="将简历文字粘贴到这里..." className="w-full h-40 bg-surface-card border border-border rounded-xl p-4 text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-brand/60 resize-none" />
          </div>

          <div className="mb-8">
            <label className="text-text-muted text-sm mb-2 block">目标岗位JD（可选，有JD分析更精准）</label>
            <textarea value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} placeholder="粘贴目标岗位的职位描述..." className="w-full h-28 bg-surface-card border border-border rounded-xl p-4 text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-brand/60 resize-none" />
          </div>

          <button onClick={handleAnalyze} disabled={analyzing || uploading} className="w-full py-4 bg-brand hover:bg-brand-dark disabled:bg-brand/40 text-white font-bold rounded-xl transition-all text-lg">
            {analyzing ? '分析中...' : uploading ? '解析文件中...' : '✦ 开始AI分析'}
          </button>

          {user && user.plan === 'free' && (
            <p className="text-center text-text-muted text-sm mt-3">剩余免费次数: {user.remainingQuota}/2</p>
          )}
        </div>
      </section>

      {analyzing && <AnalyzeOverlay step={analyzeStep} />}
      {result && !analyzing && <AnalysisReport result={result} />}

      {/* 定价 */}
      <section id="pricing" className="py-20 px-6 bg-surface-card/50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">按需选择，灵活付费</h2>
          <p className="text-text-muted text-center mb-14">先免费体验，有效果再升级 · 次数不累计，到期归零</p>
          
          {/* 基础版 */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-6">
              <h3 className="text-xl font-bold">基础版</h3>
              <span className="text-text-muted text-sm">AI分析 + 优化建议 + 关键词检查</span>
            </div>
            <div className="grid md:grid-cols-3 gap-5">
              <PriceCard plan="basic_weekly" price="¥9.9" desc="/周" features={['5次AI分析', '优化建议', '关键词检查']} current={user?.plan === 'basic_weekly'} />
              <PriceCard plan="basic_monthly" price="¥29" desc="/月" features={['12次AI分析', '优化建议', '关键词检查']} current={user?.plan === 'basic_monthly'} badge="热门" />
              <PriceCard plan="basic_quarterly" price="¥59" desc="/季" features={['30次AI分析', '优化建议', '关键词检查']} current={user?.plan === 'basic_quarterly'} />
            </div>
          </div>

          {/* 专业版 */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <h3 className="text-xl font-bold">专业版</h3>
              <span className="text-brand text-sm font-medium">推荐 · 解锁全部能力</span>
            </div>
            <div className="grid md:grid-cols-3 gap-5">
              <PriceCard plan="pro_weekly" price="¥19.9" desc="/周" features={['5次AI分析', '全部优化功能', 'JD精准匹配', '逐条改写示例']} current={user?.plan === 'pro_weekly'} />
              <PriceCard plan="pro_monthly" price="¥49" desc="/月" features={['12次AI分析', '全部优化功能', 'JD精准匹配', '逐条改写示例', '优先客服']} current={user?.plan === 'pro_monthly'} highlight badge="最受欢迎" />
              <PriceCard plan="pro_quarterly" price="¥99" desc="/季" features={['30次AI分析', '全部优化功能', '求职全周期覆盖', '新功能优先体验']} current={user?.plan === 'pro_quarterly'} badge="最划算" />
            </div>
          </div>

          <p className="text-center text-text-muted text-sm mt-10">💡 首次用户专享：基础版周卡仅 ¥4.9，体验后再决定</p>
        </div>
      </section>

      <footer className="py-10 px-6 border-t border-border">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="bg-brand text-white px-2 py-0.5 rounded text-sm font-bold">觅履</span>
            <span className="text-text-muted text-sm">AI简历优化平台</span>
          </div>
          <div className="text-text-muted text-sm">© 2025 觅履 MILV. All rights reserved.</div>
        </div>
      </footer>

      {showLogin && <LoginModal mode={loginMode} email={loginEmail} password={loginPassword} setEmail={setLoginEmail} setPassword={setLoginPassword} setMode={setLoginMode} onLogin={handleLogin} onClose={() => setShowLogin(false)} />}
      {showRedeem && <RedeemModal code={redeemCode} setCode={setRedeemCode} onRedeem={handleRedeem} onClose={() => setShowRedeem(false)} />}
    </div>
  )
}

// ========== 子组件 ==========
function Nav({ user, onLogin, onRedeem, onLogout }: { user: User | null; onLogin: () => void; onRedeem: () => void; onLogout: () => void }) {
  return (
    <nav className="fixed top-0 w-full bg-surface/80 backdrop-blur-xl border-b border-border z-50">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <span className="bg-brand text-white px-2.5 py-1 rounded-lg text-sm font-bold">觅履</span>
          <div className="hidden md:flex gap-6">
            {['功能', '流程', '开始', '定价'].map(item => (
              <a key={item} href={`#${item === '功能' ? 'features' : item === '流程' ? 'how' : item === '开始' ? 'start' : 'pricing'}`} className="text-text-muted hover:text-text-primary text-sm transition-colors">{item}</a>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onRedeem} className="px-4 py-2 text-sm text-text-muted hover:text-text-primary border border-border rounded-lg transition-all">兑换</button>
          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-text-secondary">{user.displayName}</span>
              <button onClick={onLogout} className="text-text-muted hover:text-text-primary text-sm">退出</button>
            </div>
          ) : (
            <button onClick={onLogin} className="px-5 py-2 bg-brand hover:bg-brand-dark text-white text-sm font-medium rounded-lg transition-all">登录</button>
          )}
        </div>
      </div>
    </nav>
  )
}

function AnalyzeOverlay({ step }: { step: number }) {
  const steps = [
    { icon: '📤', label: '提交分析请求' },
    { icon: '📄', label: '解析简历结构' },
    { icon: '🔍', label: '提取关键信息' },
    { icon: '🧠', label: 'AI深度分析' },
    { icon: '📊', label: '生成优化报告' },
  ]
  return (
    <div className="fixed inset-0 bg-surface/95 backdrop-blur-sm z-40 flex items-center justify-center">
      <div className="text-center">
        <div className="relative w-24 h-24 mx-auto mb-8">
          <div className="absolute inset-0 bg-brand/20 rounded-full animate-pulse-ring" />
          <div className="absolute inset-2 bg-brand/30 rounded-full animate-pulse-ring" style={{ animationDelay: '0.5s' }} />
          <div className="absolute inset-4 bg-brand rounded-full flex items-center justify-center text-3xl">{steps[Math.min(step - 1, 4)]?.icon || '✦'}</div>
        </div>
        <div className="space-y-3 max-w-xs mx-auto">
          {steps.map((s, i) => (
            <div key={i} className={`flex items-center gap-3 text-sm transition-all duration-500 ${i < step ? 'text-brand' : 'text-text-muted/40'}`}>
              <span className="text-base">{i < step ? '✓' : '○'}</span><span>{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function AnalysisReport({ result }: { result: AnalysisResult }) {
  return (
    <section className="py-20 px-6">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-10">分析报告</h2>
        <div className="text-center mb-12">
          <div className="inline-flex flex-col items-center">
            <div className="text-7xl font-black text-brand animate-fade-up">{result.overallScore}</div>
            <div className="text-text-muted mt-2">综合评分</div>
          </div>
          {result.jdMatch !== undefined && (
            <div className="mt-4"><span className="text-sm text-text-muted">JD匹配度: </span><span className="text-brand font-bold">{result.jdMatch}%</span></div>
          )}
        </div>
        <div className="grid md:grid-cols-4 gap-4 mb-12">
          {Object.entries(result.dimensions).map(([key, dim], i) => (
            <div key={key} className="bg-surface-card rounded-2xl p-5 border border-border animate-fade-up" style={{ animationDelay: `${i * 150}ms` }}>
              <div className="flex justify-between items-center mb-3"><span className="text-sm text-text-muted">{dim.label}</span><span className="text-brand font-bold text-lg">{dim.score}</span></div>
              <div className="w-full h-2 bg-border rounded-full overflow-hidden mb-3"><div className="h-full bg-brand rounded-full transition-all duration-1000" style={{ width: `${dim.score}%` }} /></div>
              <p className="text-text-muted text-xs leading-relaxed">{dim.comment}</p>
            </div>
          ))}
        </div>
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <div className="bg-surface-card rounded-2xl p-6 border border-border">
            <h3 className="font-bold text-lg mb-4">✅ 亮点</h3>
            <ul className="space-y-3">{result.strengths.map((s, i) => <li key={i} className="text-text-secondary text-sm leading-relaxed flex gap-2"><span className="text-brand shrink-0">•</span>{s}</li>)}</ul>
          </div>
          <div className="bg-surface-card rounded-2xl p-6 border border-border">
            <h3 className="font-bold text-lg mb-4">⚠️ 待改进</h3>
            <ul className="space-y-3">{result.weaknesses.map((w, i) => <li key={i} className="text-text-secondary text-sm leading-relaxed flex gap-2"><span className="text-brand shrink-0">•</span>{w}</li>)}</ul>
          </div>
        </div>
        <div className="bg-surface-card rounded-2xl p-6 border border-border mb-8">
          <h3 className="font-bold text-lg mb-6">💡 逐条优化建议</h3>
          <div className="space-y-6">
            {result.suggestions.map((s, i) => (
              <div key={i} className="border-l-2 border-brand pl-5">
                <div className="mb-2"><span className="text-text-muted text-xs">原文</span><p className="text-red-400/80 text-sm line-through">{s.original}</p></div>
                <div className="mb-2"><span className="text-brand text-xs">优化后</span><p className="text-green-400 text-sm font-medium">{s.improved}</p></div>
                <p className="text-text-muted text-xs">{s.reason}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-brand/5 border border-brand/20 rounded-2xl p-6 text-center">
          <p className="text-text-secondary leading-relaxed">{result.summary}</p>
        </div>
      </div>
    </section>
  )
}

function PriceCard({ plan, price, desc, dailyPrice, features, current, highlight, badge, savings }: { plan: string; price: string; desc: string; dailyPrice?: string; features: string[]; current: boolean; highlight?: boolean; badge?: string; savings?: string }) {
  return (
    <div className={`rounded-2xl p-6 border transition-all relative ${highlight ? 'border-brand bg-brand/5 scale-105' : 'border-border bg-surface-card'}`}>
      {badge && <div className="text-center mb-3"><span className="bg-brand text-white text-xs px-3 py-1 rounded-full font-medium">{badge}</span></div>}
      {savings && <div className="absolute top-4 right-4 bg-brand/10 text-brand text-xs px-2 py-0.5 rounded font-medium">{savings}</div>}
      <div className="text-center mb-6">
        <h3 className="font-bold text-lg mb-1">
          {plan === 'free' ? '免费体验' : 
           plan.startsWith('basic_') ? '基础版' + (plan.endsWith('weekly') ? '·周卡' : plan.endsWith('monthly') ? '·月卡' : '·季卡') :
           plan.startsWith('pro_') ? '专业版' + (plan.endsWith('weekly') ? '·周卡' : plan.endsWith('monthly') ? '·月卡' : '·季卡') :
           plan}
        </h3>
        <div className="flex items-baseline justify-center gap-1"><span className="text-4xl font-black">{price}</span><span className="text-text-muted text-sm">{desc}</span></div>
        {dailyPrice && <div className="text-text-muted/60 text-xs mt-1">{dailyPrice}</div>}
      </div>
      <ul className="space-y-3 mb-6">{features.map((f) => <li key={f} className="text-text-secondary text-sm flex items-center gap-2"><span className="text-brand">✓</span>{f}</li>)}</ul>
      <button className={`w-full py-3 rounded-xl font-medium text-sm transition-all ${current ? 'bg-border text-text-muted cursor-default' : highlight ? 'bg-brand hover:bg-brand-dark text-white' : 'bg-surface-hover hover:bg-border text-text-primary border border-border'}`}>{current ? '当前方案' : '选择方案'}</button>
    </div>
  )
}

function LoginModal({ mode, email, password, setEmail, setPassword, setMode, onLogin, onClose }: { mode: 'login' | 'register'; email: string; password: string; setEmail: (v: string) => void; setPassword: (v: string) => void; setMode: (v: 'login' | 'register') => void; onLogin: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface-card border border-border rounded-2xl p-8 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-6">{mode === 'login' ? '登录觅履' : '注册账号'}</h2>
        <div className="space-y-4">
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="邮箱地址" className="w-full px-4 py-3 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-brand/60" />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="密码" className="w-full px-4 py-3 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-brand/60" />
          <button onClick={onLogin} className="w-full py-3 bg-brand hover:bg-brand-dark text-white font-medium rounded-xl transition-all">{mode === 'login' ? '登录' : '注册'}</button>
        </div>
        <div className="my-6 flex items-center gap-3"><div className="flex-1 h-px bg-border" /><span className="text-text-muted text-xs">或</span><div className="flex-1 h-px bg-border" /></div>
        <div className="space-y-3">
          <button className="w-full py-3 bg-surface border border-border rounded-xl text-sm text-text-secondary hover:bg-surface-hover transition-all flex items-center justify-center gap-2">🔵 Google 登录</button>
          <button className="w-full py-3 bg-surface border border-border rounded-xl text-sm text-text-secondary hover:bg-surface-hover transition-all flex items-center justify-center gap-2">🐙 GitHub 登录</button>
        </div>
        <p className="text-center text-text-muted text-sm mt-6">{mode === 'login' ? '没有账号？' : '已有账号？'}<button onClick={() => setMode(mode === 'login' ? 'register' : 'login')} className="text-brand hover:underline ml-1">{mode === 'login' ? '注册' : '登录'}</button></p>
      </div>
    </div>
  )
}

function RedeemModal({ code, setCode, onRedeem, onClose }: { code: string; setCode: (v: string) => void; onRedeem: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface-card border border-border rounded-2xl p-8 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-2">兑换码</h2>
        <p className="text-text-muted text-sm mb-6">输入兑换码激活会员权益</p>
        <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="MILV-XXXX-XXXX" className="w-full px-4 py-3 bg-surface border border-border rounded-xl text-sm font-mono tracking-widest focus:outline-none focus:border-brand/60 mb-6 text-center" />
        <button onClick={onRedeem} className="w-full py-3 bg-brand hover:bg-brand-dark text-white font-medium rounded-xl transition-all">兑换</button>
        <p className="text-text-muted text-xs mt-4 text-center">测试码: MILV-TEST-1234</p>
      </div>
    </div>
  )
}
