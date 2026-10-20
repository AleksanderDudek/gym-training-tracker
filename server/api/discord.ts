import type { FeedbackRecord } from './store';

/**
 * Nowa uwaga także na kanale autora na Discordzie — przez webhook kanału. Baza zostaje źródłem:
 * wiadomość zapisuje się najpierw, a Discord dostaje kopię w tle; gdy nie odpowie, nic nie ginie
 * (lista za hasłem ma wszystko). Ślad wizyty zostaje w bazie — na kanale jest treść, ekran,
 * e-mail (do odpowiedzi), zrzut i odnośnik do listy.
 */

/**
 * Tylko adres webhooka Discorda. Sekret wpisuje człowiek; literówka albo cudzy adres nie może
 * kazać serwerowi wysyłać uwag gdzie indziej.
 */
const WEBHOOK = /^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/;

export const validWebhook = (url: unknown): url is string => typeof url === 'string' && WEBHOOK.test(url);

/** Kolor paska wiadomości: pomarańcz aplikacji (`--c-orange`). */
const COLOR = 0xe8732a;
/** Limity Discorda: opis osadzenia do 4096 znaków, wartość pola do 1024. */
const DESCRIPTION_MAX = 4096;
const FIELD_MAX = 1024;

const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

const SHOT = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+=*)$/;

/** Zrzut z `data:` URL jako plik do załączenia; `null`, gdy go nie ma albo nie jest obrazkiem. */
export function shotFile(shot: string | null): { name: string; type: string; bytes: Uint8Array<ArrayBuffer> } | null {
  const m = shot?.match(SHOT);
  if (!m) return null;
  const ext = m[1] === 'jpeg' ? 'jpg' : m[1]!;
  const raw = atob(m[2]!);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return { name: `zrzut.${ext}`, type: `image/${m[1]}`, bytes };
}

/**
 * Treść wiadomości dla webhooka. `allowed_mentions` puste: „@everyone” albo „<@id>” w treści
 * od obcej osoby nikogo nie zawoła.
 */
export function discordPayload(f: FeedbackRecord, adminUrl: string, shotName: string | null): Record<string, unknown> {
  return {
    username: 'GYM TRACKER',
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: 'Nowa uwaga z aplikacji',
        url: adminUrl,
        description: clip(f.text, DESCRIPTION_MAX),
        color: COLOR,
        fields: [
          { name: 'Ekran', value: clip(f.view || '—', FIELD_MAX), inline: true },
          { name: 'E-mail', value: clip(f.email ?? 'nie podano', FIELD_MAX), inline: true },
        ],
        ...(shotName && { image: { url: `attachment://${shotName}` } }),
        timestamp: new Date(f.created).toISOString(),
        footer: { text: `${f.id} · ślad wizyty na liście uwag` },
      },
    ],
    ...(shotName && { attachments: [{ id: 0, filename: shotName }] }),
  };
}

/** Zapytanie do webhooka: JSON wiadomości i zrzut jako załącznik w jednym formularzu. */
export function discordRequest(webhook: string, f: FeedbackRecord, adminUrl: string): Request {
  const shot = shotFile(f.screenshot);
  const form = new FormData();
  form.append('payload_json', JSON.stringify(discordPayload(f, adminUrl, shot?.name ?? null)));
  if (shot) form.append('files[0]', new Blob([shot.bytes], { type: shot.type }), shot.name);
  return new Request(`${webhook}?wait=true`, { method: 'POST', body: form });
}

/**
 * Wysyła uwagę na kanał. Nie rzuca: błąd Discorda (limit, usunięty webhook) trafia do logów
 * Workera, a wiadomość i tak czeka w bazie.
 */
export async function notifyDiscord(
  webhook: string,
  f: FeedbackRecord,
  adminUrl: string,
  send: (r: Request) => Promise<Response> = (r) => fetch(r),
): Promise<boolean> {
  try {
    const res = await send(discordRequest(webhook, f, adminUrl));
    if (res.ok) return true;
    console.error(JSON.stringify({ discord: res.status, feedback: f.id }));
  } catch (e) {
    console.error(JSON.stringify({ discord: String(e), feedback: f.id }));
  }
  return false;
}
