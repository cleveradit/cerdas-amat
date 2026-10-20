# Implementation Plan: TICKET-008 (Susunan keypad ala HP)

**Ticket:** `TICKET-008`  
**Status:** `DONE`  
**Target Audience:** AI Developer Agents  
**Depends On:** `None`

---

## 1. Business Decision Snapshot (Approved)

| Item | Approved Value |
|---|---|
| Susunan angka | Ala keypad HP: `1 2 3` di baris atas, `7 8 9` di baris ketiga (bukan kalkulator `7 8 9` di atas) |
| Kolom kanan | `AC` (tinggi 2 baris, sejajar baris 1–2), `Hapus` (sejajar `7 8 9`), `Enter` (sejajar `0`, tinggi 1 baris) |
| Baris bawah | `0` selebar 3 kolom + `Enter` |
| Tombol simbol screenshot (`%`, spasi, `@?#`, `,`, `=`, `.`) | Tidak dipakai (jawaban hanya bilangan bulat 1–81) |
| Gaya visual | Tema terang yang sekarang tetap (PRD: hanya tema terang); `Hapus` dan `Enter` tampil sebagai ikon (⌫, ↵), nama aksesibel tetap `Hapus` / `Enter` |
| Fungsi tombol & keyboard fisik | Tidak berubah |

Susunan akhir:

```
[ 1 ][ 2 ][ 3 ][ AC ]
[ 4 ][ 5 ][ 6 ][ AC ]
[ 7 ][ 8 ][ 9 ][ ⌫  ]
[      0      ][ ↵  ]
```

---

## 2. Objective

Keypad permainan disusun seperti keypad angka di HP (1-2-3 di atas) agar terasa familiar bagi pemain yang terbiasa mengetik angka di ponsel. Fungsi, ukuran keseluruhan (4 baris × 50 px), dan gaya tema tidak berubah.

---

## 3. Non-Negotiable Technical Contract

1. File: `apps/client/src/screens/Permainan.svelte`
   - `KEYS` menjadi `[['1','2','3','ac'], ['4','5','6'], ['7','8','9','del'], ['0','enter']] as const` (grid auto-placement; `ac` span 2 baris mengisi kolom kanan baris 2).
   - Tombol mendapat `class:ac={k === 'ac'}` dan `class:del={k === 'del'}` (menggantikan `class:fn` gabungan; `fn` tetap dipakai untuk warna keduanya).
   - Tombol `del` dan `enter` merender ikon SVG inline (`aria-hidden="true"`) dan `aria-label={label(k)}`; tombol lain tetap menampilkan `label(k)` sebagai teks.
   - `press()`, `onKeydown()`, dan fungsi `label()` tidak berubah.
2. File: `apps/client/src/styles/theme.css`
   - `.key.enter`: hapus `grid-row: span 2`.
   - Tambah `.key.ac { grid-row: span 2; }`.
   - `.key.zero { grid-column: span 3; }` tetap.
   - Tambah gaya ikon `.key svg` (ukuran ~22 px, `stroke: currentColor`).
3. File: `apps/client/src/i18n/id.ts`
   - Tidak berubah (`game.del`, `game.ac`, `game.enter` tetap dipakai sebagai label/aria-label).
4. File: `docs/initiate-file/cerdas-amat-gdd.md`
   - Bagian "Keypad" dan baris "Keypad: seperti kalkulator" diperbarui menjadi susunan ala HP.

---

## 4. Scope of Changes

### A. Komponen

1. Ubah `KEYS` dan markup tombol di `Permainan.svelte` sesuai kontrak.
2. Tambah dua ikon SVG inline (backspace, enter) tanpa aset eksternal.

### B. Gaya

1. Pindahkan span 2 baris dari `Enter` ke `AC` di `theme.css`.

### C. Dokumen

1. Perbarui GDD bagian Keypad.
2. Perbarui `docs/features/gameplay.md` bila menyebut susunan keypad.

---

## 5. Acceptance Test Matrix

| Case | Input | Expected Result | Status |
|---|---|---|---|
| Susunan | Buka layar permainan | Baris atas `1 2 3 AC`, baris 3 `7 8 9 ⌫`, baris bawah `0` lebar + `↵` | `[x]` |
| Fungsi tetap | Tekan `4`, `2`, ⌫, `2`, ↵ untuk soal 6×7 | Jawaban 42 terkirim, skor naik | `[x]` |
| Nama aksesibel | `getByRole('button', { name: 'Enter' })` dan `{ name: 'Hapus' }` | Keduanya ditemukan (e2e lama tetap lolos) | `[x]` |
| Boundary: layar 320 px | e2e `layar 320 px` | Keypad dan Enter terlihat penuh, tanpa scroll horizontal | `[x]` |
| Failure: keypad terkunci | Fase `paused` / `countdown` | Semua tombol termasuk ikon `disabled` | `[x]` |

---

## 6. Verification Commands

1. `pnpm typecheck`
2. `pnpm lint`
3. `pnpm test`
4. `pnpm e2e`

Expected:

1. Semua lolos tanpa error.
2. Tes e2e `visual.spec.ts` (320 px) dan `match.spec.ts` lolos tanpa diubah.

---

## 7. Out of Scope

1. Tema gelap atau warna tombol ala screenshot.
2. Tombol simbol (`%`, spasi, `@?#`, `,`, `=`, `.`).
3. Perubahan fungsi tombol, batas 2 digit, atau pemetaan keyboard fisik.
4. Perubahan ukuran/tinggi keypad.

---

## 8. Completion Checklist

- [x] Section 1 fully filled and status set correctly.
- [x] All Non-Negotiable Technical Contract items implemented.
- [x] Acceptance Test Matrix completed.
- [x] Verification commands executed successfully.
- [x] No out-of-scope changes introduced.
