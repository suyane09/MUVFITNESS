/* MUV FITNESS - Callback OAuth do Melhor Envio
   ---------------------------------------------------------------------------
   Depois que você autoriza o aplicativo "MUV FITNESS" na sua conta do Melhor
   Envio, ele redireciona o navegador pra cá com um parâmetro "code" na URL.
   Aqui trocamos esse código pelo access_token + refresh_token e guardamos
   os dois numa tabela do Supabase (me_tokens), pra usar depois no cálculo
   de frete (api/calculate-shipping.js).

   Variáveis de ambiente necessárias (Vercel -> Settings -> Environment Variables):
     ME_CLIENT_ID       -> Client ID do app cadastrado em Área Dev (Melhor Envio)
     ME_CLIENT_SECRET   -> Client Secret do mesmo app
     ME_REDIRECT_URI    -> https://muvfiitness.com.br/api/melhor-envio-callback
                            (tem que ser IDÊNTICA à cadastrada no app)
     SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY -> as mesmas já usadas no
                            mercadopago-webhook.js

   Tabela necessária no Supabase (rodar uma vez no SQL Editor):
     create table if not exists me_tokens (
       id int primary key default 1,
       access_token text,
       refresh_token text,
       expires_at timestamptz,
       updated_at timestamptz default now()
     );
     insert into me_tokens (id) values (1) on conflict (id) do nothing;

   O token de acesso do Melhor Envio expira a cada 30 dias — o
   api/calculate-shipping.js (próximo passo) é responsável por renovar
   automaticamente usando o refresh_token, então essa autorização manual
   só precisa ser feita esta vez.
*/

export default async function handler(req, res) {
  const code = req.query.code;
  const error = req.query.error;

  if (error) {
    res.status(400).send(`Autorização recusada pelo Melhor Envio: ${error}`);
    return;
  }
  if (!code) {
    res.status(400).send('Código de autorização ausente.');
    return;
  }

  const clientId = process.env.ME_CLIENT_ID;
  const clientSecret = process.env.ME_CLIENT_SECRET;
  const redirectUri = process.env.ME_REDIRECT_URI;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!clientId || !clientSecret || !redirectUri || !supabaseUrl || !serviceKey) {
    console.error('[MUV Melhor Envio] variáveis de ambiente ausentes.');
    res.status(500).send('Integração não configurada corretamente. Verifique as variáveis de ambiente na Vercel.');
    return;
  }

  try {
    const tokenRes = await fetch('https://melhorenvio.com.br/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        // Obrigatório pelo Melhor Envio: nome da aplicação + e-mail de contato.
        'User-Agent': 'MUV FITNESS (muvfiitness@gmail.com)'
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code
      })
    });

    const data = await tokenRes.json();

    if (!tokenRes.ok || !data.access_token) {
      console.error('[MUV Melhor Envio] erro ao trocar código por token:', data);
      res.status(502).send('Não foi possível concluir a autorização com o Melhor Envio. Tente gerar o link de autorização de novo.');
      return;
    }

    const expiresAt = new Date(Date.now() + (data.expires_in || 2592000) * 1000).toISOString();

    const saveRes = await fetch(`${supabaseUrl}/rest/v1/me_tokens?id=eq.1`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: expiresAt,
        updated_at: new Date().toISOString()
      })
    });

    if (!saveRes.ok) {
      console.error('[MUV Melhor Envio] erro ao salvar token no Supabase:', await saveRes.text());
      res.status(500).send('Autorização recebida, mas não foi possível salvar o token. Confira se a tabela me_tokens existe no Supabase.');
      return;
    }

    res.status(200).send('Integração com o Melhor Envio concluída! Pode fechar esta página.');
  } catch (err) {
    console.error('[MUV Melhor Envio] erro inesperado:', err);
    res.status(500).send('Erro inesperado ao concluir a autorização.');
  }
}
