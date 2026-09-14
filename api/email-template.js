/* MUV FITNESS - Template visual único para todos os e-mails transacionais
   ---------------------------------------------------------------------------
   Antes, cada arquivo (send-welcome-email.js, process-payment.js,
   mercadopago-webhook.js, admin-orders.js) montava seu próprio HTML "solto",
   sem cabeçalho, sem logo e sem link pro site — cada e-mail parecia diferente
   do outro.

   Este arquivo centraliza o "casco" (cabeçalho com logo, botão de ação e
   rodapé com WhatsApp/Instagram/site) usado por TODOS os e-mails. Cada
   arquivo continua 100% responsável pela SUA mensagem — só passa o título,
   o texto e (se tiver) a tabela de itens pra função abaixo, que devolve o
   HTML final já com a cara oficial da marca.

   Não precisa de nenhuma variável de ambiente nova.
*/

export const SITE_URL = 'https://muvfiitness.com.br';
export const WHATSAPP_URL = 'https://wa.me/5582982143150';
export const INSTAGRAM_URL = 'https://www.instagram.com/use.muvfitness';

const LOGO_URL = `${SITE_URL}/logo-muv-black.jpg`;

const COLOR = {
  ink: '#231f1d',
  inkSoft: '#6f6963',
  bg: '#faf6f4',
  line: '#eae0e0',
  pinkDeep: '#b96c83'
};

/**
 * Monta o HTML completo de um e-mail transacional com a identidade visual
 * padrão da MUV FITNESS (logo, moldura, botão e rodapé iguais em todos).
 *
 * @param {Object} p
 * @param {string} p.preheader - Texto curto de pré-visualização (some no corpo do e-mail, aparece só na caixa de entrada).
 * @param {string} p.title - Título principal (ex.: "Bem-vinda à MUV FITNESS!").
 * @param {string} p.introHtml - Parágrafo(s) de abertura, em HTML.
 * @param {string} [p.extraHtml] - HTML opcional entre a intro e a nota final (ex.: tabela de itens do pedido).
 * @param {string} [p.noteHtml] - Parágrafo final opcional, em tom mais discreto (antes do rodapé fixo).
 * @param {string} [p.ctaLabel] - Texto do botão de ação (ex.: "Ver minha conta"). Se omitido, não mostra botão.
 * @param {string} [p.ctaUrl] - Link do botão de ação. Padrão: SITE_URL.
 */
export function buildEmailHtml({
  preheader = '',
  title,
  introHtml,
  extraHtml = '',
  noteHtml = '',
  ctaLabel = '',
  ctaUrl = SITE_URL
}) {
  const cta = ctaLabel
    ? `<tr>
        <td align="center" style="padding:4px 32px 32px;">
          <a href="${ctaUrl}" target="_blank" rel="noopener"
             style="background:${COLOR.ink};color:#ffffff;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:600;letter-spacing:.02em;padding:14px 34px;border-radius:999px;display:inline-block;">
            ${ctaLabel}
          </a>
        </td>
      </tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:${COLOR.bg};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLOR.bg};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;border:1px solid ${COLOR.line};">

          <tr>
            <td align="center" style="padding:30px 32px 22px;border-bottom:1px solid ${COLOR.line};">
              <img src="${LOGO_URL}" alt="MUV FITNESS" width="84" style="display:block;margin:0 auto;">
            </td>
          </tr>

          <tr>
            <td style="padding:32px 32px 4px;font-family:Arial,Helvetica,sans-serif;color:${COLOR.ink};">
              <h1 style="font-family:Georgia,'Times New Roman',serif;font-weight:normal;font-size:22px;line-height:1.3;margin:0 0 16px;color:${COLOR.ink};">${title}</h1>
              <div style="font-size:15px;line-height:1.65;color:${COLOR.ink};">${introHtml}</div>
              ${extraHtml}
              ${noteHtml ? `<p style="font-size:13.5px;line-height:1.6;color:${COLOR.inkSoft};margin:20px 0 0;">${noteHtml}</p>` : ''}
            </td>
          </tr>

          ${cta}

          <tr>
            <td style="padding:22px 32px;background:${COLOR.bg};border-top:1px solid ${COLOR.line};border-radius:0 0 16px 16px;font-family:Arial,Helvetica,sans-serif;">
              <p style="margin:0 0 10px;font-size:12.5px;line-height:1.6;color:${COLOR.inkSoft};">
                Dúvidas? Fale com a gente pelo
                <a href="${WHATSAPP_URL}" target="_blank" rel="noopener" style="color:${COLOR.pinkDeep};text-decoration:none;font-weight:600;">WhatsApp</a>
                ou visite
                <a href="${SITE_URL}" target="_blank" rel="noopener" style="color:${COLOR.pinkDeep};text-decoration:none;font-weight:600;">muvfiitness.com.br</a>.
              </p>
              <p style="margin:0 0 6px;font-size:11.5px;">
                <a href="${INSTAGRAM_URL}" target="_blank" rel="noopener" style="color:${COLOR.inkSoft};text-decoration:none;">@use.muvfitness</a>
              </p>
              <p style="margin:0;font-size:11px;color:#a39c95;">© ${new Date().getFullYear()} MUV FITNESS. Todos os direitos reservados.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Tabela de itens do pedido, reaproveitada pelos e-mails de pedido/pagamento. */
export function buildOrderItemsHtml(order) {
  const rows = (order.items || [])
    .map(item => `<tr>
        <td style="padding:8px 0;border-bottom:1px solid ${COLOR.line};font-size:14px;color:${COLOR.ink};">
          ${item.qty}x ${item.name}${item.color || item.size ? ` <span style="color:${COLOR.inkSoft};">(${[item.color, item.size].filter(Boolean).join(' · ')})</span>` : ''}
        </td>
        <td style="padding:8px 0;border-bottom:1px solid ${COLOR.line};font-size:14px;text-align:right;white-space:nowrap;color:${COLOR.ink};">
          R$ ${(item.price * item.qty).toFixed(2).replace('.', ',')}
        </td>
      </tr>`)
    .join('');

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 6px;">
      ${rows}
      <tr>
        <td style="padding:12px 0 0;font-size:15px;font-weight:700;color:${COLOR.ink};">Total</td>
        <td style="padding:12px 0 0;font-size:15px;font-weight:700;text-align:right;color:${COLOR.ink};">R$ ${Number(order.total || 0).toFixed(2).replace('.', ',')}</td>
      </tr>
    </table>`;
}
