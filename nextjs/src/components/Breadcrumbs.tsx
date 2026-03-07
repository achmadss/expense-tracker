'use client';

import { Fragment } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

interface Crumb {
  label: string;
  href?: string;
}

export default function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav className="flex items-center gap-1.5 text-sm text-[#858585] mb-6">
      {crumbs.map((crumb, i) => (
        <Fragment key={i}>
          {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-[#3e3e42]" />}
          {crumb.href
            ? <Link href={crumb.href} className="hover:text-[#d4d4d4] transition-colors">{crumb.label}</Link>
            : <span className="text-[#d4d4d4]">{crumb.label}</span>}
        </Fragment>
      ))}
    </nav>
  );
}
