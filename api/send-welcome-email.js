/* MUV FITNESS - Envia e-mail de boas-vindas quando alguém se cadastra
   ---------------------------------------------------------------------------
   O cadastro em si acontece no navegador da cliente (js/supabase-auth.js),
   usando a chave pública do Supabase — por isso não dá pra mandar o e-mail
   direto de lá: a API key do Brevo é secreta e só pode existir no servidor.

   Este endpoint recebe {name, email} depois que o cadastro no Supabase deu
   certo e manda o e-mail de boas-vindas por aqui.

   Variáveis de ambiente necessárias (já devem existir, usadas também em
   process-payment.js):
     BREVO_API_KEY
     BREVO_SENDER_EMAIL
*/

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

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">
        <h2 style="font-family:Georgia,serif;">MUV FITNESS</h2>
        <p>Oi${firstName ? ' ' + firstName : ''}! Seu cadastro foi feito com sucesso 🎉</p>
        <p>Agora você já pode acompanhar seus pedidos e endereços direto na sua conta.</p>
        <p style="color:#666;font-size:13px;margin-top:24px;">Qualquer dúvida, fale com a gente pelo WhatsApp: https://wa.me/5582982143150</p>
      </div>`;

    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'api-key': apiKey
      },
      body: JSON.stringify({
        sender: { name: 'MUV FITNESS', email: senderEmail },
        to: [{ email }],
        subject: 'Bem-vinda à MUV FITNESS!',
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
