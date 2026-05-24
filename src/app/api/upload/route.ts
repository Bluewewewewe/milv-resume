import { NextRequest, NextResponse } from 'next/server'
import mammoth from 'mammoth'
import pdfParse from 'pdf-parse'
import { checkRateLimit, getClientIp, DEFAULT_UPLOAD_LIMIT } from '@/lib/rate-limit'

// 文件上传解析接口
// 前端上传docx/pdf/txt文件，后端解析返回纯文本
export async function POST(req: NextRequest) {
  try {
    // IP限流
    const ip = getClientIp(req)
    const rateCheck = checkRateLimit(ip, DEFAULT_UPLOAD_LIMIT)
    if (!rateCheck.allowed) {
      return NextResponse.json({
        error: '上传太频繁，请稍后再试',
        resetAt: rateCheck.resetAt,
      }, { status: 429 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: '请上传文件' }, { status: 400 })
    }

    const fileName = file.name.toLowerCase()
    const buffer = Buffer.from(await file.arrayBuffer())

    let text = ''

    if (fileName.endsWith('.docx')) {
      // 解析Word文档
      const result = await mammoth.extractRawText({ buffer })
      text = result.value
    } else if (fileName.endsWith('.pdf')) {
      // 解析PDF
      const result = await pdfParse(buffer)
      text = result.text
    } else if (fileName.endsWith('.txt') || fileName.endsWith('.md')) {
      // 纯文本直接读
      text = buffer.toString('utf-8')
    } else if (fileName.endsWith('.doc')) {
      // .doc格式比较麻烦，提示用户转docx
      return NextResponse.json({
        error: '暂不支持.doc格式，请用Word另存为.docx后上传',
      }, { status: 400 })
    } else {
      return NextResponse.json({
        error: '不支持的文件格式，请上传 PDF、Word(.docx) 或 TXT 文件',
      }, { status: 400 })
    }

    // 清理文本：去掉多余空白
    text = text
      .replace(/\r\n/g, '\n')           // 统一换行
      .replace(/\n{3,}/g, '\n\n')       // 多个空行合并
      .replace(/[ \t]+/g, ' ')          // 多空格合一
      .trim()

    if (text.length < 20) {
      return NextResponse.json({
        error: '简历内容太少了，请确认文件内容正确',
      }, { status: 400 })
    }

    if (text.length > 50000) {
      return NextResponse.json({
        error: '简历内容过长，请精简后重试（最多5万字）',
      }, { status: 400 })
    }

    return NextResponse.json({
      text,
      fileName: file.name,
      fileSize: file.size,
      charCount: text.length,
    })

  } catch (error) {
    console.error('File parse error:', error)
    return NextResponse.json({
      error: '文件解析失败，请确认文件未损坏',
    }, { status: 500 })
  }
}
