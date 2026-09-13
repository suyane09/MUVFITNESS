/* MUV FITNESS - Devolve a Chave Pública do Mercado Pago pro front-end.
   -----------------------------------------------------------------
   A Chave Pública (Public Key) NÃO é secreta — ela é feita pra ser usada
   no navegador do cliente (é o que o SDK.js do Mercado Pago usa pra
   tokenizar o cartão direto no navegador, sem os dados do cartão nunca
   passarem pelo nosso servidor).

   Mesmo assim, ela fica numa variável de ambiente (MP_PUBLIC_KEY, configurada
   na Vercel) em vez de hardcoded no código, pra ser fácil trocar entre a
   chave de teste (sandbox) e a de produção sem precisar mexer no front-end.
*/

export default function handler(req, res) {
  const publicKey = process.env.MP_PUBLIC_KEY;

  if (!publicKey) {
    console.error('[MUV checkout] MP_PUBLIC_KEY não configurada.');
    res.status(500).json({ error: 'Pagamento indisponível no momento. Tente novamente mais tarde.' });
    return;
  }

  res.status(200).json({ publicKey });
}
