import { NextRequest } from 'next/server'

// 简易IP限流
// 用内存Map记录，重启清零（够用，不需要Redis）
// 生产环境可换Redis

interface RateLimitEntry {
  count: number
  resetAt: number
}

const ipMap = new Map<string, RateLimitEntry>()

// 定期清理过期记录（每10分钟）
setInterval(() => {
  const now = Date.now()
  for (const [ip, entry] of ipMap) {
    if (now > entry.resetAt) {
      ipMap.delete(ip)
    }
  }
}, 10 * 60 * 1000)

export interface RateLimitConfig {
  /** 时间窗口（毫秒） */
  windowMs: number
  /** 窗口内最大请求数 */
  maxRequests: number
}

// 默认配置：每IP每天最多10次分析
export const DEFAULT_ANALYZE_LIMIT: RateLimitConfig = {
  windowMs: 24 * 60 * 60 * 1000, // 24小时
  maxRequests: 10,
}

// 上传限流：每IP每小时最多20次
export const DEFAULT_UPLOAD_LIMIT: RateLimitConfig = {
  windowMs: 60 * 60 * 1000, // 1小时
  maxRequests: 20,
}

export function checkRateLimit(
  ip: string,
  config: RateLimitConfig = DEFAULT_ANALYZE_LIMIT
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const entry = ipMap.get(ip)

  // 没有记录 或 已过期 → 重置
  if (!entry || now > entry.resetAt) {
    const resetAt = now + config.windowMs
    ipMap.set(ip, { count: 1, resetAt })
    return { allowed: true, remaining: config.maxRequests - 1, resetAt }
  }

  // 有记录且未过期
  if (entry.count >= config.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  entry.count++
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
  }
}

// 从请求中提取客户端IP
export function getClientIp(req: NextRequest): string {
  // 优先从代理头取真实IP
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  const realIp = req.headers.get('x-real-ip')
  if (realIp) {
    return realIp.trim()
  }
  return 'unknown'
}
