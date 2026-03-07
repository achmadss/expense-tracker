'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts';

interface Summary {
  totalSpent: number;
  transactionCount: number;
  avgPerTransaction: number;
}

interface CategoryData {
  category: string;
  total: number;
}

interface DailyData {
  date: string;
  total: number;
}

interface TopItem {
  name: string;
  total: number;
}

interface DashboardData {
  summary: Summary;
  categoryData: CategoryData[];
  dailyData: DailyData[];
  topItems: TopItem[];
}

function formatAmount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function getDefaultRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 29);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

const STORAGE_KEY = 'expense-dashboard-range';

export default function Dashboard() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setStartDate(parsed.startDate || getDefaultRange().startDate);
        setEndDate(parsed.endDate || getDefaultRange().endDate);
        return;
      }
    } catch {
      // ignore
    }
    const defaults = getDefaultRange();
    setStartDate(defaults.startDate);
    setEndDate(defaults.endDate);
  }, []);

  const fetchData = useCallback(async (start: string, end: string) => {
    if (!start || !end) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/expenses/dashboard?startDate=${start}&endDate=${end}`);
      if (res.ok) {
        setData(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (startDate && endDate) {
      fetchData(startDate, endDate);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ startDate, endDate }));
      } catch {
        // ignore
      }
    }
  }, [startDate, endDate, fetchData]);

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <h2 className="text-2xl font-semibold text-[#d4d4d4]">Dashboard</h2>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-sm text-[#858585]">From</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-1.5 bg-[#3c3c3c] border border-[#3e3e42] rounded text-sm text-[#d4d4d4] focus:outline-none focus:ring-1 focus:ring-[#4fc1ff]"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-[#858585]">To</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-1.5 bg-[#3c3c3c] border border-[#3e3e42] rounded text-sm text-[#d4d4d4] focus:outline-none focus:ring-1 focus:ring-[#4fc1ff]"
            />
          </div>
        </div>
      </div>

      {loading && (
        <div className="text-center py-8 text-[#858585] text-sm">Loading...</div>
      )}

      {!loading && data && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-[#252526] border border-[#3e3e42] rounded-lg p-5">
              <p className="text-sm text-[#858585] mb-1">Total Spent</p>
              <p className="text-2xl font-bold text-[#d4d4d4]">
                {data.summary.totalSpent.toLocaleString()}
              </p>
            </div>
            <div className="bg-[#252526] border border-[#3e3e42] rounded-lg p-5">
              <p className="text-sm text-[#858585] mb-1">Transactions</p>
              <p className="text-2xl font-bold text-[#d4d4d4]">
                {data.summary.transactionCount}
              </p>
            </div>
            <div className="bg-[#252526] border border-[#3e3e42] rounded-lg p-5">
              <p className="text-sm text-[#858585] mb-1">Avg per Transaction</p>
              <p className="text-2xl font-bold text-[#d4d4d4]">
                {data.summary.avgPerTransaction.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Category Bar Chart */}
            <div className="bg-[#252526] border border-[#3e3e42] rounded-lg p-5">
              <h3 className="text-sm font-semibold text-[#d4d4d4] mb-4">Spending by Category</h3>
              {data.categoryData.length === 0 ? (
                <p className="text-sm text-[#858585] text-center py-8">No data</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={data.categoryData}
                    layout="vertical"
                    margin={{ top: 0, right: 16, bottom: 0, left: 8 }}
                  >
                    <XAxis
                      type="number"
                      tickFormatter={formatAmount}
                      tick={{ fontSize: 11, fill: '#858585' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="category"
                      width={110}
                      tick={{ fontSize: 11, fill: '#858585' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(value) => [Number(value).toLocaleString(), 'Total']}
                      contentStyle={{ backgroundColor: '#252526', border: '1px solid #3e3e42', color: '#d4d4d4' }}
                    />
                    <Bar dataKey="total" fill="#0e639c" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Daily Spending Line Chart */}
            <div className="bg-[#252526] border border-[#3e3e42] rounded-lg p-5">
              <h3 className="text-sm font-semibold text-[#d4d4d4] mb-4">Daily Spending</h3>
              {data.dailyData.length === 0 ? (
                <p className="text-sm text-[#858585] text-center py-8">No data</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart
                    data={data.dailyData}
                    margin={{ top: 4, right: 16, bottom: 0, left: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#3e3e42" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: '#858585' }}
                      axisLine={false}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tickFormatter={formatAmount}
                      tick={{ fontSize: 11, fill: '#858585' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(value) => [Number(value).toLocaleString(), 'Total']}
                      contentStyle={{ backgroundColor: '#252526', border: '1px solid #3e3e42', color: '#d4d4d4' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="total"
                      stroke="#4fc1ff"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Top Items */}
          {data.topItems.length > 0 && (
            <div className="bg-[#252526] border border-[#3e3e42] rounded-lg p-5">
              <h3 className="text-sm font-semibold text-[#d4d4d4] mb-3">Top Items</h3>
              <div className="space-y-2">
                {data.topItems.map((item, i) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[#858585] w-4">{i + 1}</span>
                      <span className="text-sm text-[#d4d4d4]">{item.name}</span>
                    </div>
                    <span className="text-sm font-medium text-[#4fc1ff]">
                      {item.total.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
