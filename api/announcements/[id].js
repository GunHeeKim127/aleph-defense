import { readFileSync } from 'node:fs';
import { createAnnouncementsHandler } from '../../src/announcements-api.mjs';
import { sessionAuth } from '../../src/server-session.mjs';

const config = JSON.parse(readFileSync(new URL('../../aleph.config.json', import.meta.url), 'utf8'));
export default sessionAuth.wrap(createAnnouncementsHandler({ config }));
