import { notFound } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { ArrowLeft, Edit } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import StatusBadge from '@/components/StatusBadge';
import DeleteExpenseButton from '@/components/DeleteExpenseButton';

interface Props {
  params: Promise<{ id: string }>;
}

async function getExpense(id: string) {
  return prisma.expense.findUnique({ where: { id } });
}

interface ExtractedData {
  items?: Array<{ name: string; price: number; quantity: number }>;
  tax?: number;
  total?: number;
}

function parseExtracted(raw: string | null): ExtractedData | null {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export default async function ExpenseDetailPage({ params }: Props) {
  const { id } = await params;
  const expense = await getExpense(id);

  if (!expense) notFound();

  const extracted = parseExtracted(expense.extractedData);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <Link href="/expenses" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-800 mb-6 text-sm">
          <ArrowLeft className="w-4 h-4" />
          Back to Expenses
        </Link>

        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{expense.text || 'Expense'}</h1>
            <p className="text-sm text-gray-400 mt-1">ID: {expense.id}</p>
          </div>
          <StatusBadge status={expense.status} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Submission Info */}
          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Submission</h2>

            <Field label="User Tag" value={expense.userTag} />
            <Field label="User ID" value={expense.userId} />
            {expense.messageId && <Field label="Message ID" value={expense.messageId} />}
            {expense.channelId && <Field label="Channel ID" value={expense.channelId} />}
            <Field label="Source" value={expense.isDm ? 'Direct Message' : 'Channel'} />
            <Field label="Submitted At" value={format(new Date(expense.timestamp), 'PPpp')} />
            <Field label="Record Created" value={format(new Date(expense.createdAt), 'PPpp')} />
          </div>

          {/* Extracted Data */}
          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Extracted Data</h2>

            {extracted ? (
              <>
                {extracted.items && extracted.items.length > 0 ? (
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Items</p>
                    <div className="space-y-1">
                      {extracted.items.map((item, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-gray-700">
                            {item.quantity > 1 && <span className="text-gray-400 mr-1">{item.quantity}×</span>}
                            {item.name}
                          </span>
                          <span className="font-medium text-gray-900">{item.price.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {extracted.tax !== undefined && (
                  <div className="flex justify-between text-sm border-t pt-2">
                    <span className="text-gray-500">Tax</span>
                    <span className="text-gray-700">{extracted.tax.toLocaleString()}</span>
                  </div>
                )}

                {extracted.total !== undefined && (
                  <div className="flex justify-between text-sm font-semibold border-t pt-2">
                    <span className="text-gray-700">Total</span>
                    <span className="text-gray-900">{extracted.total.toLocaleString()}</span>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-400 italic">
                {expense.status === 'completed' ? 'No structured data extracted.' : 'Not yet processed.'}
              </p>
            )}
          </div>

          {/* Raw Description */}
          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Raw Description</h2>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{expense.text || <span className="italic text-gray-400">None</span>}</p>

            {expense.ocrText && (
              <>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide pt-2">OCR Text</h2>
                <pre className="text-xs bg-gray-50 border rounded p-3 overflow-auto max-h-48 whitespace-pre-wrap text-gray-600">
                  {expense.ocrText}
                </pre>
              </>
            )}
          </div>

          {/* Receipt Images */}
          {expense.imageUrls.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Receipts</h2>
              <div className="grid grid-cols-2 gap-3">
                {expense.imageUrls.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block">
                    <img
                      src={url}
                      alt={`Receipt ${i + 1}`}
                      className="w-full h-32 object-cover rounded border hover:opacity-80 transition-opacity"
                    />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-8">
          <Link
            href={`/expenses/${id}/edit`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Edit className="w-4 h-4" />
            Edit
          </Link>
          <DeleteExpenseButton id={id} />
        </div>

      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm text-gray-800 font-medium break-all">{value}</p>
    </div>
  );
}
