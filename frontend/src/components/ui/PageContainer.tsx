import React from 'react';
import { clsx } from 'clsx';
import Sidebar from '../layout/Sidebar';

interface PageContainerProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  maxWidth?: string;
  noScroll?: boolean;
}

export default function PageContainer({
  children,
  header,
  className,
  contentClassName,
  maxWidth = 'max-w-[1440px]',
  noScroll = false,
}: PageContainerProps) {
  return (
    <div className={clsx('h-screen flex bg-bg overflow-hidden w-full print:hidden', className)}>
      {/* Unified Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-bg min-w-0">
        {/* Sticky/Fixed Page Header */}
        {header}

        {/* Scrollable Viewport */}
        <main
          className={clsx(
            'flex-1 min-w-0',
            noScroll ? 'overflow-hidden flex flex-col' : 'overflow-y-auto overflow-x-hidden p-6 md:p-8 space-y-6'
          )}
        >
          <div className={clsx('mx-auto w-full space-y-6', maxWidth, contentClassName)}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
