/**
 * Bug6 测试用 Mock AI Service
 * 启动一个极简 HTTP server 模拟 AI service 的 /extract/feature 和 /compare/vector 接口
 * 特点:
 *   - /extract/feature 返回固定 512 维零向量 + 一点 noise
 *     (这样同张图的多次提取结果都是相同向量, cosine=1.0)
 *   - /compare/vector 返回 cosine_similarity=0.99
 *
 * 端口: 18000 (通过 env BUG6_MOCK_AI_PORT 可覆盖)
 */
const http = require('http');
const crypto = require('crypto');

const PORT = parseInt(process.env.BUG6_MOCK_AI_PORT || '18000', 10);

// 给定 image bytes, 用 sha256 生成确定性 512 维向量
// 这样同一张图(同样的 base64) 多次调用, 一定得到同一个向量, cosine=1.0
function deterministicVector(imageBytes) {
  const hash = crypto.createHash('sha512').update(imageBytes).digest();
  const vec = [];
  for (let i = 0; i < 512; i++) {
    // 每 2 个字节做一个 [-1, 1] 范围的值
    const byte = hash[i % hash.length];
    vec.push(((byte / 255) * 2 - 1).toFixed(6) * 1);
  }
  return vec;
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (chunk) => body += chunk);
  req.on('end', () => {
    res.setHeader('Content-Type', 'application/json');
    try {
      const data = JSON.parse(body || '{}');
      if (req.url === '/extract/feature') {
        // 用 image bytes 生成确定性 vector
        const vec = deterministicVector(data.image || '');
        return res.end(JSON.stringify({ vector: vec, dimension: 512 }));
      }
      if (req.url === '/compare/vector') {
        const a = data.vector_a || [];
        const b = data.vector_b || [];
        const sim = a.length && b.length ? cosine(a, b) : 0;
        return res.end(JSON.stringify({
          cosine_similarity: sim,
          l2_distance: 0,
        }));
      }
      if (req.url === '/classify/breed') {
        return res.end(JSON.stringify({ breed: 'mixed', confidence: 0.9, top3: [] }));
      }
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'not found' }));
    } catch (e) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: e.message }));
    }
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[bug6-mock-ai] listening on http://127.0.0.1:${PORT}`);
});

// 优雅退出
process.on('SIGTERM', () => server.close());
process.on('SIGINT', () => server.close());
