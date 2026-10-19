import type { Character } from '@cerdas-amat/shared';
import { beruang } from './beruang';
import { katak } from './katak';
import { kucing } from './kucing';
import { panda } from './panda';
import { rubah } from './rubah';
import type { PartMaps } from './voxel';

export type { Part, PartMaps } from './voxel';

/** Data voxel 5 karakter, identik dengan preview yang disetujui. */
export const SPECS: Record<Character, () => PartMaps> = { kucing, beruang, rubah, panda, katak };
