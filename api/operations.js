import { sessionAuth } from '../src/server-session.mjs';
import { deviceApproval } from '../src/server-device-approval.mjs';
import { operations } from '../src/server-operations.mjs';

export default sessionAuth.wrap(deviceApproval.guard(operations));

