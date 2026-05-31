import { Suspense } from 'react';
import { TransactionDetail } from './TransactionDetail';

interface PageProps {
  params: { id: string };
}

/**
 * Server wrapper. The actual detail UI is a client component (uses
 * React Query, useState for inline edit, etc.); we wrap it in a
 * Suspense boundary so the route is statically prerenderable when
 * possible.
 */
export default function TransactionDetailPage({ params }: PageProps) {
  return (
    <Suspense fallback={<div className="h-[600px]" aria-hidden />}>
      <TransactionDetail id={params.id} />
    </Suspense>
  );
}
