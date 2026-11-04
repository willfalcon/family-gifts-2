// Fake accounts for local testing. They're ordinary Better Auth email/password
// users, so every backend function treats them like real people. The app's
// dev user switcher signs in as them, and `npx convex run mockUsers:seed`
// creates them ahead of time (so you can invite them before ever using them).
//
// Emails use example.com, which is reserved and never receives mail.
// Dev only: never create these on the production deployment.

export const MOCK_USER_PASSWORD = 'mock-user-password';

export const MOCK_USERS = [
  { name: 'Will Hawks', firstName: 'Will', lastName: 'Hawks', email: 'willkhawks@gmail.com' },
  { name: 'Leigh Ann Hawks', firstName: 'Leigh Ann', lastName: 'Hawks', email: 'leighann@example.com' },
  { name: 'Bill Hawks', firstName: 'Bill', lastName: 'Hawks', email: 'bill@example.com' },
  { name: 'Morgan Hawks', firstName: 'Morgan', lastName: 'Hawks', email: 'morgan@example.com' },
  { name: 'Cody Hawks', firstName: 'Cody', lastName: 'Hawks', email: 'cody@example.com' },
  { name: 'Kassy Hawks', firstName: 'Kassy', lastName: 'Hawks', email: 'kassy@example.com' },
  { name: 'Annie Hawks', firstName: 'Annie', lastName: 'Hawks', email: 'annie@example.com' },
  { name: 'Anna Hawks', firstName: 'Anna', lastName: 'Hawks', email: 'anna@example.com' },
] as const;

export type MockUser = (typeof MOCK_USERS)[number];
