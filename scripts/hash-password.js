// scripts/hash-password.js
//
// Rode LOCALMENTE (nunca no navegador) para gerar o hash da nova senha:
//
//   node scripts/hash-password.js "SuaSenhaNovaEForte123!"
//
// Copie o valor impresso para a variável de ambiente ADMIN_PASSWORD_HASH
// no painel da Vercel. A senha em texto puro nunca é salva em lugar nenhum.

const bcrypt = require('bcryptjs');

const password = process.argv[2];

if (!password) {
  console.error('Uso: node scripts/hash-password.js "sua-senha-aqui"');
  process.exit(1);
}

if (password.length < 10) {
  console.warn('Aviso: use uma senha com pelo menos 10 caracteres.');
}

bcrypt.hash(password, 12).then((hash) => {
  console.log('\nAdicione esta variável de ambiente na Vercel (Project Settings → Environment Variables):\n');
  console.log(`ADMIN_PASSWORD_HASH=${hash}`);
  console.log('\nDefina também:');
  console.log('ADMIN_USERNAME=seu-usuario-escolhido');
  console.log('JWT_SECRET=<uma string aleatória longa, ex: gerada com `openssl rand -hex 32`>\n');
});
