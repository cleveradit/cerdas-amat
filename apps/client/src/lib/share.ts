import { id } from '../i18n/id';

export const roomLink = (code: string) => `${location.origin}/?room=${code}`;

/**
 * Bagikan link room lewat Web Share API; tanpa itu, salin ke clipboard.
 * `manual` berarti keduanya gagal dan link perlu ditampilkan untuk disalin sendiri.
 */
export async function shareRoom(code: string): Promise<'shared' | 'copied' | 'manual'> {
  const url = roomLink(code);
  if (navigator.share) {
    try {
      await navigator.share({ title: id.title, text: id.lobby.shareText(code), url });
      return 'shared';
    } catch (err) {
      // Pemain menutup lembar bagikan: tidak perlu cara lain.
      if (err instanceof DOMException && err.name === 'AbortError') return 'shared';
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'manual';
  }
}
