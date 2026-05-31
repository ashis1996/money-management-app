import { Suspense } from 'react';
import { LoginForm } from './LoginForm';

/**
 * Server wrapper. The actual form is a client component that reads
 * `?next=` from the URL via `useSearchParams()`, which requires a
 * Suspense boundary during static prerender. Wrapping at the page
 * level keeps the prerender working without forcing the whole route
 * to render dynamically.
 */
export default function LoginPage() {
  return (
    <Suspense fallback={<div className="h-[480px]" aria-hidden="true" />}>
      <LoginForm />
    </Suspense>
  );
}
