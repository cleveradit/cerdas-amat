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
| Kolom kanan | `AC` (sejajar `1 2 3`), `Hapus` (sejajar `4 5 6`), `Enter` (tinggi 2 baris, sejajar `7 8 9` dan `0`) |
| Baris bawah | `0` selebar 3 kolom + lanjutan `Enter` |
| Tombol simbol screenshot (`%`, spasi, `@?#`, `,`, `=`, `.`) | Tidak dipakai (jawaban hanya bilangan bulat 1–81) |
| Gaya visual | Tema terang yang sekarang tetap (PRD: hanya tema terang); `Hapus` dan `Enter` tampil sebagai ikon (⌫, ↵), nama aksesibel tetap `Hapus` / `Enter` |
| Fungsi tombol & keyboard fisik | Tidak berubah |

Susunan akhir:

```
[ 1 ][ 2 ][ 3 ][ AC ]
[ 4 ][ 5 ][ 6 ][ ⌫  ]
[ 7 ][ 8 ][ 9 ][ ↵  ]
[      0      ][ ↵  ]
```

---

## 2. Objective

Keypad permainan disusun seperti keypad angka di HP (1-2-3 di atas) agar terasa familiar bagi pemain yang terbiasa mengetik angka di ponsel. Fungsi, ukuran keseluruhan (4 baris × 50 px), dan gaya tema tidak berubah.

---

## 3. Non-Negotiable Technical Contract

1. File: `apps/client/src/screens/Permainan.svelte`
   - `KEYS` menjadi `[['1','2','3','ac'], ['4','5','6','del'], ['7','8','9','enter'], ['0']] as const` (grid auto-placement; `enter` span 2 baris mengisi kolom kanan baris 4).
   - Kelas tombol tetap (`fn` untuk AC dan Hapus, `enter`, `zero`).
   - Tombol `del` dan `enter` merender ikon SVG inline (`aria-hidden="true"`) dan `aria-label={label(k)}`; tombol lain tetap menampilkan `label(k)` sebagai teks.
   - `press()`, `onKeydown()`, dan fungsi `label()` tidak berubah.
2. File: `apps/client/src/styles/theme.css`
   - `.key.enter`: tetap `grid-row: span 2`.
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

1. `Enter` tetap span 2 baris di `theme.css`; tambah gaya ikon.

### C. Dokumen

1. Perbarui GDD bagian Keypad.
2. Perbarui `docs/features/gameplay.md` bila menyebut susunan keypad.

---

## 5. Acceptance Test Matrix

| Case | Input | Expected Result | Status |
|---|---|---|---|
| Susunan | Buka layar permainan | Baris atas `1 2 3 AC`, baris 2 `4 5 6 ⌫`, `↵` setinggi baris 3–4, baris bawah `0` lebar | `[x]` |
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
