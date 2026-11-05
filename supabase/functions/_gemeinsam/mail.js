// Mailversand fuer Edge Functions ueber Resend (https://resend.com, Datenregion EU). Gebraucht von abo-beenden.js fuer
// die Bestaetigungen nach § 312k und § 356a BGB (Textform bzw. dauerhafter Datentraeger, also E-Mail).
// Reines ES-Modul, in Node getestet (tests/server-abo-beenden.test.mjs).
//
// API:
//   RESEND_API = 'https://api.resend.com/emails'
//   mailBereit(umgebung) -> boolean           RESEND_API_KEY (re_...) und ABO_MAIL_ABSENDER ("Name <adresse>") gesetzt
//   sendeMail(holen, umgebung, { an, betreff, text }) -> Promise<{ ok, status }>
//       Nur Klartext (kein HTML: nichts, was ein Mailprogramm ausfuehren koennte). Schluessel und Empfaenger gehen nie
//       ins Protokoll; die Antwort enthaelt nur ok und den HTTP-Status.

export const RESEND_API = 'https://api.resend.com/emails';

const MUSTER = Object.freeze({
  schluessel: /^re_[A-Za-z0-9_]{10,200}$/,
  absender: /^[^<>\r\n]{0,80}<[^\s@<>"']{1,100}@[^\s@<>"']{1,100}\.[A-Za-z]{2,63}>$|^[^\s@<>"']{1,100}@[^\s@<>"']{1,100}\.[A-Za-z]{2,63}$/,
  email: /^[^\s@<>"']{1,200}@[^\s@<>"']{1,200}\.[A-Za-z]{2,63}$/,
});

export function mailBereit(umgebung = {}) {
  return MUSTER.schluessel.test(String(umgebung.RESEND_API_KEY || '').trim())
    && MUSTER.absender.test(String(umgebung.ABO_MAIL_ABSENDER || '').trim());
}

export async function sendeMail(holen, umgebung, { an, betreff, text, idempotenz } = {}) {
  if (!mailBereit(umgebung)) return { ok: false, status: null };
  if (typeof an !== 'string' || !MUSTER.email.test(an)) return { ok: false, status: null };
  const kopf = {
    Authorization: `Bearer ${String(umgebung.RESEND_API_KEY).trim()}`,
    'Content-Type': 'application/json',
  };
  if (idempotenz) kopf['Idempotency-Key'] = String(idempotenz).slice(0, 256);
  try {
    const r = await holen(RESEND_API, {
      method: 'POST',
      headers: kopf,
      body: JSON.stringify({
        from: String(umgebung.ABO_MAIL_ABSENDER).trim(),
        to: [an],
        subject: String(betreff || '').slice(0, 200),
        text: String(text || '').slice(0, 10000),
      }),
    });
    return { ok: !!(r && r.ok), status: r ? r.status : null };
  } catch (e) {
    return { ok: false, status: null };
  }
}
