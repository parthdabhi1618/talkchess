/**
 * Demo mode signs everyone in as a shared demo user on startup, so the app
 * opens straight into a playable game with no login screen.
 *
 * Set VITE_DEMO_MODE=false to restore the normal login flow.
 */
export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE !== 'false';
