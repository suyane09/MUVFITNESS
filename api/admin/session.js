// api/admin/session.js
//
// Usado pelo admin.html ao carregar a página, para decidir se mostra a
// tela de login ou o painel direto (sessão ainda válida).

const { getSessionFromRequest } = require('../_lib/auth');

module.exports = async function handler(req, res) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({ authenticated: false });
  }
  return res.status(200).json({ authenticated: true, username: session.sub });
};
