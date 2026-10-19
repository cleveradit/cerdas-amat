const query =
  typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

/** `prefers-reduced-motion: reduce` aktif; dibaca tiap frame agar ikut perubahan setelan. */
export function reducedMotion(): boolean {
  return query?.matches ?? false;
}
