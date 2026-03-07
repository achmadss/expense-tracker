'use client';

import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { X, Upload, FileText } from 'lucide-react';

const expenseItemSchema = z.object({
  name: z.string().min(1, 'Item name is required'),
  price: z.coerce.number().int().min(0),
  quantity: z.coerce.number().int().min(1),
});

const expenseSchema = z.object({
  description: z.string().optional(),
  aiDescription: z.string().optional(),
  text: z.string(),
  userId: z.string().optional(),
  userTag: z.string().optional(),
  messageId: z.string().optional(),
  channelId: z.string().optional(),
  isDm: z.boolean().optional(),
  timestamp: z.string().optional(),
  items: z.array(expenseItemSchema).optional(),
  tax: z.coerce.number().int().min(0).optional(),
});

type ExpenseFormData = z.infer<typeof expenseSchema>;

interface ExpenseItem {
  name: string;
  price: number;
  quantity: number;
}

interface ExtractedData {
  items?: ExpenseItem[];
  tax?: number;
  total?: number;
}

interface ExpenseFormProps {
  initialData?: Partial<ExpenseFormData> & {
    id?: string;
    extractedData?: ExtractedData | null;
    description?: string;
    aiDescription?: string;
    ocrText?: string;
    imageUrls?: string[];
  };
  mode?: 'create' | 'edit';
  onSuccess?: () => void;
  onClose?: () => void;
}

export default function ExpenseForm({ initialData, mode = 'edit', onSuccess, onClose }: ExpenseFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingImages, setExistingImages] = useState<string[]>(initialData?.imageUrls || []);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const extracted = initialData?.extractedData;
  const initialItems = extracted?.items || [];
  const initialTax = extracted?.tax ?? 0;
  const hasExistingImages = existingImages.length > 0;
  const hasNewFiles = newFiles.length > 0;
  const hasAnyImage = hasExistingImages || hasNewFiles;

  const validateForm = (text: string, hasImage: boolean) => {
    return text.trim().length > 0 || hasImage;
  };

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      description: initialData?.description || '',
      aiDescription: initialData?.aiDescription || '',
      text: initialData?.text || '',
      userId: initialData?.userId || '',
      userTag: initialData?.userTag || '',
      messageId: initialData?.messageId || '',
      channelId: initialData?.channelId || '',
      isDm: initialData?.isDm || false,
      timestamp: initialData?.timestamp || new Date().toISOString().slice(0, 16),
      items: initialItems,
      tax: initialTax,
    },
  });

  const watchedText = watch('text');

  useEffect(() => {
    if (fileInputRef.current) {
      fileInputRef.current.setCustomValidity(
        validateForm(watchedText, hasAnyImage) ? '' : 'At least text or image is required'
      );
    }
  }, [watchedText, hasAnyImage]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setNewFiles((prev) => [...prev, ...files]);
    
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviewUrls((prev) => [...prev, ...urls]);
  };

  const removeNewFile = (index: number) => {
    setNewFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviewUrls((prev) => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  const removeExistingImage = (index: number) => {
    setExistingImages((prev) => prev.filter((_, i) => i !== index));
  };

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const onSubmit = async (data: ExpenseFormData) => {
    setIsSubmitting(true);
    setError(null);

    const hasText = data.text && data.text.trim().length > 0;
    if (!hasText && !hasAnyImage) {
      setError('At least text or file is required');
      setIsSubmitting(false);
      return;
    }

    const items = data.items ?? [];
    const itemsTotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const total = itemsTotal + (data.tax || 0);

    try {
      if (mode === 'create') {
        if (hasNewFiles) {
          const formData = new FormData();
          formData.append('description', data.description || '');
          formData.append('text', data.text || '');
          formData.append('userId', data.userId || 'manual');
          formData.append('userTag', data.userTag || 'manual');
          
          for (const file of newFiles) {
            formData.append('files', file);
          }

          const response = await fetch('/api/expenses/upload', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to create expense');
          }

          const expense = await response.json();
          if (onSuccess) onSuccess();
          else router.push(`/expenses/${expense.id}`);
        } else {
          const payload = {
            description: data.description || null,
            text: data.text,
            userId: data.userId || 'manual',
            userTag: data.userTag || 'manual',
            timestamp: data.timestamp ? new Date(data.timestamp).toISOString() : new Date().toISOString(),
            extractedData: {
              items: data.items,
              tax: data.tax || 0,
              total,
            },
          };

          const response = await fetch('/api/expenses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

          if (!response.ok) throw new Error('Request failed');
          const expense = await response.json();
          if (onSuccess) onSuccess();
          else router.push(`/expenses/${expense.id}`);
        }
      } else {
        const payload = {
          description: data.description || null,
          text: data.text,
          imageUrls: existingImages,
          userId: data.userId || 'manual',
          userTag: data.userTag || 'manual',
          messageId: data.messageId || null,
          channelId: data.channelId || null,
          isDm: data.isDm || false,
          timestamp: data.timestamp ? new Date(data.timestamp).toISOString() : new Date().toISOString(),
          extractedData: {
            items: data.items,
            tax: data.tax || 0,
            total,
          },
        };

        const response = await fetch(`/api/expenses/${initialData?.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) throw new Error('Request failed');
        if (onSuccess) onSuccess();
        else router.push(`/expenses/${initialData?.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : (mode === 'create' ? 'Failed to create expense.' : 'Failed to update expense.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = 'w-full px-3 py-2 bg-[#3c3c3c] border border-[#3e3e42] rounded-md text-sm text-[#d4d4d4] focus:outline-none focus:ring-1 focus:ring-[#4fc1ff] placeholder-[#858585]';
  const labelClass = 'block text-sm font-medium text-[#d4d4d4] mb-1';

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {error && (
        <div className="bg-[#3c3c3c] border border-[#c72e2e] text-red-400 px-4 py-3 rounded text-sm">
          {error}
        </div>
      )}

      <div>
        <label className={labelClass}>Short Description</label>
        <input
          {...register('description')}
          type="text"
          className={inputClass}
          placeholder="e.g. Lunch meeting, Office supplies"
        />
      </div>

      <div>
        <label className={labelClass}>AI Description</label>
        <input
          {...register('aiDescription')}
          type="text"
          disabled
          className="w-full px-3 py-2 bg-[#2a2d2e] border border-[#3e3e42] rounded-md text-sm text-[#858585] cursor-not-allowed"
          placeholder="AI generated description"
        />
      </div>

      {/* Images Section */}
      <div>
        <label className={labelClass}>
          Images {!hasExistingImages && mode === 'edit' && <span className="text-[#858585]">(optional)</span>}
        </label>

        {/* Existing Images (Edit mode only) */}
        {mode === 'edit' && existingImages.length > 0 && (
          <div className="grid grid-cols-4 gap-2 mb-3">
            {existingImages.map((url, index) => {
              const isPdf = url.toLowerCase().endsWith('.pdf');
              return (
                <div key={index} className="relative group">
                  {isPdf ? (
                    <div className="w-full h-20 object-cover rounded border border-[#3e3e42] bg-[#3c3c3c] flex flex-col items-center justify-center">
                      <FileText className="w-5 h-5 text-red-400 mb-1" />
                      <span className="text-xs text-[#858585]">PDF</span>
                    </div>
                  ) : (
                    <img src={url} alt={`Receipt ${index + 1}`} className="w-full h-20 object-cover rounded border border-[#3e3e42]" />
                  )}
                  <button
                    type="button"
                    onClick={() => removeExistingImage(index)}
                    className="absolute top-1 right-1 bg-[#c72e2e] text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* New File Previews */}
        {previewUrls.length > 0 && (
          <div className="grid grid-cols-4 gap-2 mb-3">
            {previewUrls.map((url, index) => {
              const file = newFiles[index];
              const isPdf = file?.type === 'application/pdf';
              return (
                <div key={index} className="relative group">
                  {isPdf ? (
                    <div className="w-full h-20 object-cover rounded border border-[#3e3e42] bg-[#3c3c3c] flex items-center justify-center">
                      <span className="text-xs text-[#858585]">PDF</span>
                    </div>
                  ) : (
                    <img src={url} alt={`New ${index + 1}`} className="w-full h-20 object-cover rounded border border-[#3e3e42]" />
                  )}
                  <button
                    type="button"
                    onClick={() => removeNewFile(index)}
                    className="absolute top-1 right-1 bg-[#c72e2e] text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Upload Button */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          multiple
          onChange={handleFileChange}
          className="hidden"
          id="image-upload"
        />
        <button
          type="button"
          onClick={() => document.getElementById('image-upload')?.click()}
          className="inline-flex items-center gap-2 px-4 py-2 border border-dashed border-[#3e3e42] rounded-md text-sm text-[#858585] hover:border-[#4fc1ff] hover:text-[#d4d4d4] transition-colors"
        >
          <Upload className="w-4 h-4" />
          Upload Files
        </button>
        <p className="text-xs text-[#858585] mt-1">JPEG, PNG, WebP, PDF. Max 50MB each.</p>
      </div>

      <div>
        <label className={labelClass}>
          Text {!hasAnyImage && <span className="text-red-400">*</span>}
        </label>
        <textarea
          {...register('text')}
          rows={3}
          className={inputClass}
          placeholder="Receipt text or payment details"
        />
        {errors.text && <p className="text-red-400 text-xs mt-1">{errors.text.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>User Tag</label>
          <input {...register('userTag')} type="text" className={inputClass} placeholder="user#0000" />
        </div>
        <div>
          <label className={labelClass}>User ID</label>
          <input {...register('userId')} type="text" className={inputClass} placeholder="Discord user ID" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Message ID</label>
          <input {...register('messageId')} type="text" className={inputClass} placeholder="Discord message ID" />
        </div>
        <div>
          <label className={labelClass}>Channel ID</label>
          <input {...register('channelId')} type="text" className={inputClass} placeholder="Discord channel ID" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Timestamp</label>
          <input {...register('timestamp')} type="datetime-local" className={inputClass} />
        </div>
        <div className="flex items-center mt-6">
          <input
            {...register('isDm')}
            type="checkbox"
            id="isDm"
            className="w-4 h-4 rounded border-[#3e3e42] bg-[#3c3c3c] accent-[#4fc1ff]"
          />
          <label htmlFor="isDm" className="ml-2 text-sm text-[#d4d4d4]">From DM</label>
        </div>
      </div>

      <div>
        <label className={labelClass}>Tax</label>
        <input {...register('tax')} type="number" className={inputClass} placeholder="0" />
      </div>

      {/* Extracted Items */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className={labelClass}>Items</label>
          <button
            type="button"
            onClick={() => append({ name: '', price: 0, quantity: 1 })}
            className="text-xs text-[#4fc1ff] hover:text-[#d4d4d4] transition-colors"
          >
            + Add Item
          </button>
        </div>

        {fields.length === 0 ? (
          <p className="text-sm text-[#858585] italic py-2">No items added</p>
        ) : (
          <div className="space-y-2">
            {fields.map((field, index) => (
              <div key={field.id} className="flex gap-2 items-start">
                <input
                  {...register(`items.${index}.name` as const)}
                  placeholder="Item name"
                  className="flex-1 px-3 py-2 bg-[#3c3c3c] border border-[#3e3e42] rounded-md text-sm text-[#d4d4d4] focus:outline-none focus:ring-1 focus:ring-[#4fc1ff] placeholder-[#858585]"
                />
                <input
                  {...register(`items.${index}.price` as const)}
                  type="number"
                  placeholder="Price"
                  className="w-24 px-3 py-2 bg-[#3c3c3c] border border-[#3e3e42] rounded-md text-sm text-[#d4d4d4] focus:outline-none focus:ring-1 focus:ring-[#4fc1ff] placeholder-[#858585]"
                />
                <input
                  {...register(`items.${index}.quantity` as const)}
                  type="number"
                  placeholder="Qty"
                  className="w-16 px-3 py-2 bg-[#3c3c3c] border border-[#3e3e42] rounded-md text-sm text-[#d4d4d4] focus:outline-none focus:ring-1 focus:ring-[#4fc1ff] placeholder-[#858585]"
                />
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="px-2 py-2 text-red-400 hover:text-red-300 transition-colors"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 bg-[#0e639c] text-white text-sm rounded-md hover:bg-[#1177bb] disabled:opacity-50 transition-colors"
        >
          {isSubmitting ? 'Saving...' : mode === 'create' ? 'Create Expense' : 'Save Changes'}
        </button>
        <button
          type="button"
          onClick={() => onClose ? onClose() : router.back()}
          className="px-4 py-2 border border-[#3e3e42] text-[#d4d4d4] text-sm rounded-md hover:bg-[#2a2d2e] transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
