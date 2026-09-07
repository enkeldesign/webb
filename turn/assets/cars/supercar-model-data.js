import chunk1 from './supercar-data-1.js';
import chunk2 from './supercar-data-2.js';
import chunk3 from './supercar-data-3.js';
import chunk4 from './supercar-data-4.js';
import chunk5 from './supercar-data-5.js';

// The adapted GLB is gzip-compressed and split so it can remain a normal text
// repository asset while preserving the original binary bytes exactly.
export const SUPERCAR_GLB_GZIP_BASE64 = `${chunk1}${chunk2}${chunk3}${chunk4}${chunk5}`;
