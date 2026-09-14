// api/admin/login.js
//
// Faz login do administrador validando usuário/senha no servidor e
// devolvendo um cookie httpOnly assinado (JWT). Substitui a checagem
// client-side ("admin" / "muv2026" fixos no HTML) que existia antes.

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cookie = require('cookie');
const { COOKIE_NAME } = require('../_lib/auth');

const { ADMIN_USERNAME, ADMIN_PASSWORD_HASH, JWT_SECRET } = process.env;

// Proteção simples contra força bruta: limita tentativas por IP em memória.
// Em produção real, prefira Vercel KV / Upstash Ratelimit (isso aqui reseta
// a cada cold start da função, é só uma primeira barreira).
const attempts = new Map();
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 10 * 60 * 1000; // 10 minutos

function isRateLimited(ip) {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now - entry.first > WINDOW_MS) {
    attempts.set(ip, { count: 1, first: now });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  if (!ADMIN_USERNAME || !ADMIN_PASSWORD_HASH || !JWT_SECRET) {
    console.error('[admin/login] Variáveis de ambiente ausentes (ADMIN_USERNAME, ADMIN_PASSWORD_HASH, JWT_SECRET).');
    return res.status(500).json({ error: 'Configuração do servidor incompleta.' });
  }

  const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').toString();
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Muitas tentativas. Tente novamente em alguns minutos.' });
  }

  let body = req.body;
  if (!body || typeof body === 'string') {
    try { body = JSON.parse(body || '{}'); } catch { body = {}; }
  }
  const { username, password } = body || {};

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });
  }

  const validUsername = username === ADMIN_USERNAME;
  // Sempre roda o bcrypt.compare (mesmo com usuário errado) para não vazar,
  // por tempo de resposta, se o usuário existe ou não.
  const passwordToCheck = validUsername ? password : 'senha-invalida-de-propósito';
  const validPassword = await bcrypt.compare(passwordToCheck, ADMIN_PASSWORD_HASH);

  if (!validUsername || !validPassword) {
    return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
  }

  const token = jwt.sign(
    { sub: username, role: 'admin' },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.setHeader('Set-Cookie', cookie.serialize(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 8, // 8 horas
  }));

  return res.status(200).json({ ok: true });
};
