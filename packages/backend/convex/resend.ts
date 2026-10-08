import { Resend } from '@convex-dev/resend';
import { components } from './_generated/api';

// Shared client. Not a Convex function itself, so it can be imported from
// both the default runtime (mutations that call sendEmail) and "use node"
// action files (the react-email renderer) without runtime restrictions.
export const resend: Resend = new Resend(components.resend, { testMode: false });
