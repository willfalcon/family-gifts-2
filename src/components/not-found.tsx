import { Link } from '@tanstack/react-router';
import { SearchX } from 'lucide-react';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from './ui/empty';

export function NotFound() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchX />
        </EmptyMedia>
        <EmptyTitle>Not found</EmptyTitle>
        <EmptyDescription>This page doesn't exist, or you don't have access to it.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Link to="/" className="text-sm underline underline-offset-4">
          Go Home
        </Link>
      </EmptyContent>
    </Empty>
  );
}
