// Stack Auth is currently disabled as @stackframe/stack requires Next.js
// This is a temporary stub until we implement a proper Express-compatible auth solution

export const stackServerApp = {
  async getUser(_options?: any) {
    // Return null - no authentication for now
    return null;
  }
};
