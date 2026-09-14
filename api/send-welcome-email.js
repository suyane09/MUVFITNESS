/* MUV FITNESS - Envia e-mail de boas-vindas quando alguém se cadastra
   ---------------------------------------------------------------------------
   O cadastro em si acontece no navegador da cliente (js/supabase-auth.js),
   usando a chave pública do Supabase — por isso não dá pra mandar o e-mail
   direto de lá: a API key do Brevo é secreta e só pode existir no servidor.

   Este endpoint recebe {name, email} depois que o cadastro no Supabase deu
   certo e manda o e-mail de boas-vindas por aqui.

   O visual (logo, botão, rodapé) vem de api/email-template.js — é o mesmo
   "casco" usado pelos outros e-mails (pedido recebido, pagamento aprovado,
   status de entrega). Aqui só definimos a mensagem específica de boas-vindas.

   Variáveis de ambiente necessárias (já devem existir, usadas também em
   process-payment.js):
     BREVO_API_KEY
     BREVO_SENDER_EMAIL
*/

import { buildEmailHtml, SITE_URL } from './email-template.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido.' });
    return;
  }

  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  if (!apiKey || !senderEmail) {
    console.error('[MUV boas-vindas] BREVO_API_KEY ou BREVO_SENDER_EMAIL ausente.');
    // Não é um erro que a cliente precise ver — o cadastro dela já deu certo.
    res.status(200).json({ sent: false });
    return;
  }

  try {
    const { name, email } = req.body || {};

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      res.status(400).json({ error: 'E-mail inválido.' });
      return;
    }

    const firstName = (name || '').split(' ')[0] || '';

    const html = buildEmailHtml({
      preheader: 'Seu cadastro foi confirmado — bem-vinda à MUV FITNESS!',
      title: `Bem-vinda${firstName ? ', ' + firstName : ''}! 🎉`,
      introHtml: `
        <p style="margin:0 0 14px;">Seu cadastro na <strong>MUV FITNESS</strong> foi feito com sucesso.</p>
        <p style="margin:0;">A partir de agora você pode acompanhar seus pedidos, salvar endereços e finalizar suas compras muito mais rápido, direto na sua conta.</p>
      `,
      noteHtml: 'Qualquer dúvida sobre o site ou sobre um pedido, é só chamar a gente.',
      ctaLabel: 'Conhecer a coleção',
      ctaUrl: SITE_URL
    });

    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'api-key': apiKey
      },
      body: JSON.stringify({
        sender: { name: 'MUV FITNESS', email: senderEmail },
        replyTo: { name: 'MUV FITNESS', email: 'muvfiitness@gmail.com' },
        to: [{ email, name: name || undefined }],
        subject: 'Bem-vinda à MUV FITNESS! 🎉',
        htmlContent: html
      })
    });

    if (!r.ok) {
      console.error('[MUV boas-vindas] erro ao enviar:', await r.text());
      res.status(200).json({ sent: false });
      return;
    }

    res.status(200).json({ sent: true });
  } catch (err) {
    console.error('[MUV boas-vindas] erro inesperado:', err);
    res.status(200).json({ sent: false });
  }
}