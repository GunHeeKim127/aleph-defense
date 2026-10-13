import { readFileSync } from 'node:fs';
import { createRestoreNoteHandler } from '../../../src/restore-note-api.mjs';
import { sessionAuth } from '../../../src/server-session.mjs';

const config = JSON.parse(readFileSync(new URL('../../../aleph.config.json', import.meta.url), 'utf8'));
export default sessionAuth.wrap(createRestoreNoteHandler({ config }));
