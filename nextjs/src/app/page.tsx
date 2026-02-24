import Link from 'next/link';
import { format, startOfWeek, startOfMonth } from 'date-fns';
import { prisma } from '@/lib/prisma';
import StatusBadge from '@/components/StatusBadge';

export const dynamic = 'force-dynamic';

interface ExtractedData {
  items?: Array<{ name: string; price: number; quantity: number }>;
  tax?: number;
  total?: number;
}

function parseExtracted(raw: string | null): ExtractedData | null {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

async function getStats() {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);

  const [total, thisWeek, thisMonth, byStatus, recent] = await Promise.all([
    prisma.expense.count(),
    prisma.expense.count({ where: { timestamp: { gte: weekStart } } }),
    prisma.expense.count({ where: { timestamp: { gte: monthStart } } }),
    prisma.expense.groupBy({ by: ['status'], _count: { status: true } }),
    prisma.expense.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ]);

  return { total, thisWeek, thisMonth, byStatus, recent };
}

export default async function DashboardPage() {
  const { total, thisWeek, thisMonth, byStatus, recent } = await getStats();

  const statusMap = Object.fromEntries(
    byStatus.map((s) => [s.status, s._count.status])
  );

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-400 text-sm mt-1">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
          </div>
          <Link
            href="/expenses"
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            View All Expenses
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Expenses" value={total} />
          <StatCard label="This Month" value={thisMonth} />
          <StatCard label="This Week" value={thisWeek} />
          <StatCard
            label="Completed"
            value={statusMap['completed'] ?? 0}
            sub={total > 0 ? `${Math.round(((statusMap['completed'] ?? 0) / total) * 100)}%` : '0%'}
          />
        </div>

        {/* Status Breakdown */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Status Breakdown</h2>
          <div className="flex flex-wrap gap-4">
            {(['unprocessed', 'processing', 'completed', 'failed'] as const).map((s) => (
              <Link key={s} href={`/expenses?status=${s}`} className="flex items-center gap-2 hover:opacity-80">
                <StatusBadge status={s} />
                <span className="text-sm text-gray-600 font-medium">{statusMap[s] ?? 0}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Expenses */}
        <div className="bg-white rounded-lg shadow">
          <div className="flex justify-between items-center p-6 border-b">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Recent Expenses</h2>
            <Link href="/expenses" className="text-sm text-blue-600 hover:text-blue-800">View all →</Link>
          </div>

          {recent.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No expenses yet.</div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {recent.map((expense) => {
                const extracted = parseExtracted(expense.extractedData);
                return (
                  <li key={expense.id}>
                    <Link
                      href={`/expenses/${expense.id}`}
                      className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {expense.text || <span className="italic text-gray-400">no description</span>}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {expense.userTag} · {format(new Date(expense.timestamp), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <div className="flex items-center gap-4 ml-4">
                        {extracted?.total !== undefined && (
                          <span className="text-sm font-semibold text-gray-800">
                            {extracted.total.toLocaleString()}
                          </span>
                        )}
                        <StatusBadge status={expense.status} />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="bg-white rounded-lg shadow p-5">
      <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}
