import { readFileSync } from 'node:fs';
import { createNotesHandler } from '../../src/notes-api.mjs';
const config = JSON.parse(readFileSync(new URL('../../aleph.config.json', import.meta.url), 'utf8'));
export default createNotesHandler({ config, single: true });
