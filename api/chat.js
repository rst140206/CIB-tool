/**
 * Vercel Serverless Function — DeepSeek API 代理
 * 
 * 作用：接收前端请求，附上存储在环境变量中的 API Key，
 *       转发给 DeepSeek，并将响应（含流式）原样返回给前端。
 * 
 * 环境变量（在 Vercel 控制台设置，不写入任何代码文件）：
 *   DEEPSEEK_API_KEY  —  你的 DeepSeek API Key
 */

export const config = {
  runtime: 'edge',   // 使用 Edge Runtime，支持流式响应，延迟更低
};

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';

// 允许的来源域名（部署后把你的 Vercel 域名填进来，留空则允许所有来源）
const ALLOWED_ORIGINS = [
  // 'https://your-project.vercel.app',
  // 'https://your-custom-domain.com',
];

function corsHeaders(origin) {
  const allowed =
    ALLOWED_ORIGINS.length === 0 ||
    ALLOWED_ORIGINS.includes(origin);

  return {
    'Access-Control-Allow-Origin': allowed ? (origin || '*') : 'null',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export default async function handler(request) {
  const origin = request.headers.get('origin') || '';

  // 处理预检请求（CORS preflight）
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(origin),
    });
  }

  // 只接受 POST
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  }

  // 读取 API Key（来自 Vercel 环境变量）
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'Server misconfiguration: DEEPSEEK_API_KEY not set' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) } }
    );
  }

  // 解析并透传请求体
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  }

  // 转发到 DeepSeek
  const upstream = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  // 将 DeepSeek 的响应原样返回（含流式 SSE）
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') || 'application/json',
      ...corsHeaders(origin),
    },
  });
}
