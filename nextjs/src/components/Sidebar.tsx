'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { LayoutDashboard, Receipt, Download, Wrench } from 'lucide-react';
import { useProcessing } from '@/context/ProcessingContext';
import ConfirmDialog from '@/components/ConfirmDialog';

const navItems = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Expenses', href: '/expenses', icon: Receipt },
  { label: 'Maintenance', href: '/maintenance', icon: Wrench },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { progress } = useProcessing();
  const [exportConfirm, setExportConfirm] = useState(false);

  return (
    <aside className="w-56 min-h-screen bg-[#252526] text-white flex flex-col flex-shrink-0 border-r border-[#3e3e42]">
      <div className="px-6 py-5 border-b border-[#3e3e42]">
        <span className="text-sm font-semibold tracking-tight text-[#d4d4d4]">Expense Tracker</span>
      </div>
      <nav className="flex-1 py-2">
        {navItems.map(({ label, href, icon: Icon }) => {
          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);

          return (
            <Link
              key={label}
              href={href}
              className={`flex items-center gap-3 px-4 py-2 text-sm transition-colors ${
                isActive
                  ? 'text-white bg-[#094771]'
                  : 'text-[#858585] hover:text-[#d4d4d4] hover:bg-[#2a2d2e]'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          );
        })}
        <button
          onClick={() => setExportConfirm(true)}
          className="w-full flex items-center gap-3 px-4 py-2 text-sm text-[#858585] hover:text-[#d4d4d4] hover:bg-[#2a2d2e] transition-colors"
        >
          <Download className="w-4 h-4" />
          Export
        </button>
      </nav>

      {progress && (
        <div className="px-4 py-3 border-t border-[#3e3e42]">
          <div className="flex justify-between text-xs text-[#858585] mb-1.5">
            <span className="capitalize">Reprocessing {progress.targetStatus}…</span>
            <span>{progress.done}/{progress.batchIds.length}</span>
          </div>
          <div className="w-full bg-[#3e3e42] rounded-full h-1">
            <div
              className="bg-[#0e639c] h-1 rounded-full transition-all"
              style={{ width: `${Math.round((progress.done / progress.batchIds.length) * 100)}%` }}
            />
          </div>
        </div>
      )}

      <ConfirmDialog
        open={exportConfirm}
        title="Export all expenses?"
        message="This will download a CSV of all expense data."
        confirmLabel="Download"
        confirmClass="bg-[#0e639c] hover:bg-[#1177bb]"
        onConfirm={() => { window.location.href = '/api/expenses/export'; setExportConfirm(false); }}
        onCancel={() => setExportConfirm(false)}
      />
    </aside>
  );
}
