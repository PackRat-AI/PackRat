// This module re-exports the Button component from the shared @packrat/web-ui
// package so existing `landing-app/components/ui/button` imports keep working
// while we migrate apps/landing onto the shared shadcn-style package.
//
// New code should import directly from `@packrat/web-ui`.
export { Button, type ButtonProps, buttonVariants } from '@packrat/web-ui';
