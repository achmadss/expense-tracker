# Frontend Plan

## Overview
Next.js frontend for full expense management - view, add, edit, and delete expenses.

## Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard with expense summary |
| `/expenses` | List all expenses with filters |
| `/expenses/[id]` | View expense details |
| `/expenses/new` | Create new expense |
| `/expenses/[id]/edit` | Edit existing expense |

## Features

### Dashboard
- Total expenses summary
- Recent expenses list
- Quick stats (this month, this week)

### Expense List
- Paginated list of expenses
- Filters: date range, status, user
- Search by description
- Sort by date, amount

### Expense Detail
- Full expense information
- Receipt image viewer (displays from Object Storage URLs)
- Edit/Delete actions

### Create/Edit Expense
- Form fields:
  - Description (text)
  - Amount (number)
  - Category (select)
  - Date (date picker)
  - Notes (textarea)
  - Receipt image (file upload)

## UI Components

- ExpenseCard - Display expense summary
- ExpenseTable - Tabular view with sorting
- ExpenseForm - Create/edit form
- ImageUploader - Drag & drop receipt upload
- DateRangePicker - Filter by date
- StatusBadge - Visual status indicator

## API Integration

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/expenses` | Fetch expense list |
| GET | `/api/expenses/[id]` | Fetch single expense |
| POST | `/api/expenses` | Create expense |
| PUT | `/api/expenses/[id]` | Update expense |
| DELETE | `/api/expenses/[id]` | Delete expense |

## File Structure

```
nextjs/
├── src/
│   └── app/
│       ├── page.tsx              # Dashboard
│       ├── expenses/
│       │   ├── page.tsx          # Expense list
│       │   ├── new/
│       │   │   └── page.tsx      # Create expense
│       │   └── [id]/
│       │       ├── page.tsx      # Expense detail
│       │       └── edit/
│       │           └── page.tsx  # Edit expense
│       └── layout.tsx
├── src/
│   └── components/
│       ├── ExpenseCard.tsx
│       ├── ExpenseTable.tsx
│       ├── ExpenseForm.tsx
│       ├── ImageUploader.tsx
│       └── StatusBadge.tsx
└── package.json
```

## Dependencies

- `next` - Next.js
- `react` - React
- `react-hook-form` - Form handling
- `zod` - Schema validation
- `lucide-react` - Icons
- `date-fns` - Date utilities
- `tailwindcss` - Styling
