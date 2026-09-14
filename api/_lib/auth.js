// api/_lib/auth.js
//
// Helper compartilhado de autenticação do painel admin.
// Qualquer endpoint em /api/admin/* que leia ou altere dados sensíveis
// (produtos, pedidos, cupons, configurações) DEVE chamar requireAdminAuth()
// antes de fazer qualquer outra coisa. Exemplo de uso no fim deste arquivo.

const jwt = require('jsonwebtoken');
const cookie = require('cookie');

const { JWT_SECRET } = process.env;
const COOKIE_NAME = 'muv_admin_session';

function getSessionFromRequest(req) {
  if (!JWT_SECRET) {
    console.error('[auth] JWT_SECRET não configurado nas variáveis de ambiente.');
    return null;
  }

  const cookies = cookie.parse(req.headers.cookie || '');
  const token = cookies[COOKIE_NAME];
  if (!token) return null;

  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    // token inválido, expirado ou adulterado
    return null;
  }
}

// Chame isto no topo de qualquer handler protegido.
// Retorna a sessão se autenticado, ou já responde 401 e retorna null caso contrário.
//
// Exemplo:
//   const { requireAdminAuth } = require('../_lib/auth');
//
//   module.exports = async function handler(req, res) {
//     const session = requireAdminAuth(req, res);
//     if (!session) return; // resposta 401 já foi enviada
//
//     // ...lógica normal do endpoint (listar/editar produtos, pedidos, etc)
//   };
function requireAdminAuth(req, res) {
  const session = getSessionFromRequest(req);
  if (!session || session.role !== 'admin') {
    res.status(401).json({ error: 'Não autenticado.' });
    return null;
  }
  return session;
}

module.exports = { getSessionFromRequest, requireAdminAuth, COOKIE_NAME };
