"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  FileText,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  addTicketExpense,
  deleteTicketExpense,
  fetchTicketExpenses,
  getExpenseReceiptUrl,
  updateTicketExpense,
} from "@/app/actions/ticket-expenses";
import { useToast } from "@/components/Toast";
import { formatCurrency, formatDate } from "@/lib/format";
import { parseReceiptPaths } from "@/lib/ticket-expenses";
import {
  EXPENSE_TYPES,
  type ExpenseType,
  type TicketExpense,
} from "@/lib/types";

const TYPE_ICONS: Record<ExpenseType, string> = {
  Travel: "✈️",
  Supplies: "📦",
  Meals: "🍽️",
  Parking: "🅿️",
  Miscellaneous: "🧾",
};

const MAX_RECEIPTS = 10;

type ReceiptDraft = {
  id: string;
  file: File;
  previewUrl: string | null;
};

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const base64 = result.includes(",") ? result.split(",")[1]! : result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Read failed"));
    reader.readAsDataURL(file);
  });
}

function makeReceiptDraft(file: File): ReceiptDraft {
  return {
    id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
    file,
    previewUrl: file.type.startsWith("image/")
      ? URL.createObjectURL(file)
      : null,
  };
}

interface ExpenseTrackerProps {
  ticketId: string;
  technicianId?: string | null;
  ticketLabel?: string;
}

export function ExpenseTracker({
  ticketId,
  technicianId,
  ticketLabel,
}: ExpenseTrackerProps) {
  const { showToast } = useToast();
  const receiptRef = useRef<HTMLInputElement>(null);
  const receiptsRef = useRef<ReceiptDraft[]>([]);

  const [expenses, setExpenses] = useState<TicketExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [type, setType] = useState<ExpenseType>("Travel");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(todayIsoDate);
  const [receipts, setReceipts] = useState<ReceiptDraft[]>([]);

  useEffect(() => {
    receiptsRef.current = receipts;
  }, [receipts]);

  useEffect(() => {
    return () => {
      for (const item of receiptsRef.current) {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      }
    };
  }, []);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editType, setEditType] = useState<ExpenseType>("Travel");
  const [editAmount, setEditAmount] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDate, setEditDate] = useState(todayIsoDate);

  const total = useMemo(
    () => expenses.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    [expenses],
  );

  const loadExpenses = useCallback(async () => {
    if (!ticketId) {
      setExpenses([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const rows = await fetchTicketExpenses(ticketId);
    setExpenses(rows);
    setLoading(false);
  }, [ticketId]);

  useEffect(() => {
    void loadExpenses();
  }, [loadExpenses]);

  function clearReceipts() {
    setReceipts((current) => {
      for (const item of current) {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      }
      return [];
    });
    if (receiptRef.current) receiptRef.current.value = "";
  }

  function handleReceiptsSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    const room = MAX_RECEIPTS - receipts.length;
    if (room <= 0) {
      showToast(`You can attach up to ${MAX_RECEIPTS} photos.`, "error");
      if (receiptRef.current) receiptRef.current.value = "";
      return;
    }

    const selected = Array.from(fileList);
    if (selected.length > room) {
      showToast(`Only ${room} more photo(s) can be added.`, "error");
    }

    const nextFiles = selected.slice(0, room).map(makeReceiptDraft);
    setReceipts((current) => [...current, ...nextFiles]);

    if (receiptRef.current) receiptRef.current.value = "";
  }

  function removeReceipt(id: string) {
    setReceipts((current) => {
      const target = current.find((item) => item.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return current.filter((item) => item.id !== id);
    });
  }

  function resetForm() {
    setType("Travel");
    setAmount("");
    setDescription("");
    setDate(todayIsoDate());
    clearReceipts();
  }

  async function handleAdd() {
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      showToast("Enter a positive amount.", "error");
      return;
    }

    setBusy(true);
    let receiptUploads: { fileName: string; fileType: string; base64: string }[] =
      [];
    if (receipts.length > 0) {
      try {
        receiptUploads = await Promise.all(
          receipts.map(async (item) => ({
            fileName: item.file.name,
            fileType: item.file.type,
            base64: await fileToBase64(item.file),
          })),
        );
      } catch {
        setBusy(false);
        showToast("Could not read receipt file(s).", "error");
        return;
      }
    }

    const result = await addTicketExpense({
      ticketId,
      technicianId,
      type,
      amount: parsed,
      description,
      date,
      receipts: receiptUploads,
    });
    setBusy(false);

    if (!result.success) {
      showToast(result.message, "error");
      return;
    }

    showToast(result.message);
    if (result.expense) {
      setExpenses((current) => [result.expense!, ...current]);
    } else {
      await loadExpenses();
    }
    resetForm();
  }

  function startEdit(row: TicketExpense) {
    setEditingId(row.id);
    setEditType((row.type as ExpenseType) || "Miscellaneous");
    setEditAmount(String(row.amount));
    setEditDescription(row.description ?? "");
    setEditDate(row.date?.slice(0, 10) || todayIsoDate());
  }

  async function handleSaveEdit(expenseId: string) {
    const parsed = Number(editAmount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      showToast("Enter a positive amount.", "error");
      return;
    }

    setBusy(true);
    const result = await updateTicketExpense({
      expenseId,
      type: editType,
      amount: parsed,
      description: editDescription,
      date: editDate,
    });
    setBusy(false);

    if (!result.success) {
      showToast(result.message, "error");
      return;
    }

    showToast(result.message);
    setEditingId(null);
    if (result.expense) {
      setExpenses((current) =>
        current.map((row) => (row.id === expenseId ? result.expense! : row)),
      );
    } else {
      await loadExpenses();
    }
  }

  async function handleDelete(expenseId: string) {
    setBusy(true);
    const previous = expenses;
    setExpenses((current) => current.filter((row) => row.id !== expenseId));
    if (editingId === expenseId) setEditingId(null);

    const result = await deleteTicketExpense(expenseId);
    setBusy(false);

    if (!result.success) {
      setExpenses(previous);
      showToast(result.message, "error");
      return;
    }
    showToast(result.message);
  }

  async function openReceipts(receiptUrl: string) {
    const paths = parseReceiptPaths(receiptUrl);
    if (paths.length === 0) {
      showToast("Could not open receipt.", "error");
      return;
    }

    let opened = 0;
    for (const path of paths) {
      const url = await getExpenseReceiptUrl(path);
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
        opened += 1;
      }
    }

    if (opened === 0) {
      showToast("Could not open receipt.", "error");
    }
  }

  if (!ticketId) {
    return (
      <div className="card border bg-base-100 shadow-sm">
        <div className="card-body py-8 text-center text-sm text-base-content/60">
          Select a ticket to log expenses.
        </div>
      </div>
    );
  }

  return (
    <div className="card border bg-base-100 shadow-sm">
      <div className="card-body gap-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="card-title text-base">Expense Tracker</h2>
            <p className="text-sm text-base-content/60">
              Quick expenses for{" "}
              <span className="font-medium text-base-content">
                {ticketLabel ?? "this ticket"}
              </span>
            </p>
          </div>
          <p className="text-sm">
            Total:{" "}
            <span className="font-semibold">{formatCurrency(total)}</span>
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
          <label className="form-control lg:col-span-1">
            <span className="label-text mb-1 text-xs">Type</span>
            <select
              className="select select-bordered select-sm"
              value={type}
              disabled={busy}
              onChange={(e) => setType(e.target.value as ExpenseType)}
            >
              {EXPENSE_TYPES.map((option) => (
                <option key={option} value={option}>
                  {TYPE_ICONS[option]} {option}
                </option>
              ))}
            </select>
          </label>

          <label className="form-control">
            <span className="label-text mb-1 text-xs">Amount</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              className="input input-bordered input-sm"
              placeholder="0.00"
              value={amount}
              disabled={busy}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>

          <label className="form-control lg:col-span-2">
            <span className="label-text mb-1 text-xs">Description</span>
            <input
              type="text"
              className="input input-bordered input-sm"
              placeholder="Optional note"
              value={description}
              disabled={busy}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          <label className="form-control">
            <span className="label-text mb-1 text-xs">Date</span>
            <input
              type="date"
              className="input input-bordered input-sm"
              value={date}
              disabled={busy}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
        </div>

        <div className="rounded-box border border-dashed border-base-300 bg-base-200/40 p-3">
          <div className="mb-2 flex items-center gap-2">
            <Camera className="size-4 text-base-content/60" aria-hidden="true" />
            <p className="text-sm font-medium">Receipt photos</p>
            <span className="text-xs text-base-content/50">(optional)</span>
            {receipts.length > 0 ? (
              <span className="badge badge-ghost badge-sm">
                {receipts.length}/{MAX_RECEIPTS}
              </span>
            ) : null}
          </div>

          <input
            ref={receiptRef}
            type="file"
            accept="image/*,.pdf"
            multiple
            className="hidden"
            onChange={(e) => handleReceiptsSelected(e.target.files)}
          />

          {receipts.length > 0 ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-3">
                {receipts.map((item) => (
                  <div
                    key={item.id}
                    className="relative w-28 overflow-hidden rounded-box border border-base-300 bg-base-100"
                  >
                    {item.previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.previewUrl}
                        alt={item.file.name}
                        className="h-24 w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-24 w-full items-center justify-center">
                        <FileText className="size-8 opacity-50" />
                      </div>
                    )}
                    <p className="truncate px-1.5 py-1 text-[10px] text-base-content/70">
                      {item.file.name}
                    </p>
                    <button
                      type="button"
                      className="btn btn-circle btn-ghost btn-xs absolute right-1 top-1 bg-base-100/90"
                      aria-label={`Remove ${item.file.name}`}
                      disabled={busy}
                      onClick={() => removeReceipt(item.id)}
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-outline btn-xs gap-1"
                  disabled={busy || receipts.length >= MAX_RECEIPTS}
                  onClick={() => receiptRef.current?.click()}
                >
                  <Upload className="size-3.5" />
                  Add more photos
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs gap-1"
                  disabled={busy}
                  onClick={clearReceipts}
                >
                  <X className="size-3.5" />
                  Clear all
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="flex w-full flex-col items-center justify-center gap-2 rounded-box border border-base-300 bg-base-100 px-4 py-6 text-center transition hover:border-primary/50 hover:bg-primary/5"
              disabled={busy}
              onClick={() => receiptRef.current?.click()}
            >
              <Upload className="size-6 text-primary" aria-hidden="true" />
              <span className="text-sm font-medium">
                Upload or take receipt photos
              </span>
              <span className="text-xs text-base-content/55">
                Select multiple JPG, PNG, or PDF files at once
              </span>
            </button>
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            className="btn btn-primary btn-sm gap-1"
            disabled={busy || !amount}
            onClick={() => void handleAdd()}
          >
            {busy ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              <Plus className="size-3.5" />
            )}
            Add Expense
          </button>
        </div>

        <div className="overflow-x-auto rounded-box border border-base-300">
          {loading ? (
            <div className="flex justify-center py-8">
              <span className="loading loading-spinner loading-md text-primary" />
            </div>
          ) : expenses.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-base-content/55">
              No expenses yet — add one above in a few seconds.
            </p>
          ) : (
            <table className="table table-zebra table-sm">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Description</th>
                  <th>Date</th>
                  <th>Receipt</th>
                  <th className="w-28">Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((row) => {
                  const icon =
                    TYPE_ICONS[row.type as ExpenseType] ??
                    TYPE_ICONS.Miscellaneous;
                  const isEditing = editingId === row.id;
                  const receiptCount = parseReceiptPaths(row.receipt_url).length;

                  if (isEditing) {
                    return (
                      <tr key={row.id}>
                        <td>
                          <select
                            className="select select-bordered select-xs"
                            value={editType}
                            onChange={(e) =>
                              setEditType(e.target.value as ExpenseType)
                            }
                          >
                            {EXPENSE_TYPES.map((option) => (
                              <option key={option} value={option}>
                                {TYPE_ICONS[option]} {option}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            className="input input-bordered input-xs w-24"
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="input input-bordered input-xs w-full min-w-[8rem]"
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="date"
                            className="input input-bordered input-xs"
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                          />
                        </td>
                        <td>
                          {receiptCount > 0 ? (
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs gap-1"
                              onClick={() => void openReceipts(row.receipt_url!)}
                            >
                              <FileText className="size-3.5" />
                              {receiptCount > 1 ? receiptCount : null}
                            </button>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              className="btn btn-primary btn-xs"
                              disabled={busy}
                              onClick={() => void handleSaveEdit(row.id)}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs"
                              onClick={() => setEditingId(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={row.id}>
                      <td>
                        <span className="whitespace-nowrap">
                          {icon} {row.type}
                        </span>
                      </td>
                      <td className="font-medium">
                        {formatCurrency(row.amount)}
                      </td>
                      <td className="max-w-[14rem] truncate">
                        {row.description || (
                          <span className="text-base-content/40">—</span>
                        )}
                      </td>
                      <td>{formatDate(row.date)}</td>
                      <td>
                        {receiptCount > 0 ? (
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs gap-1"
                            title={
                              receiptCount > 1
                                ? `View ${receiptCount} receipts`
                                : "View receipt"
                            }
                            onClick={() => void openReceipts(row.receipt_url!)}
                          >
                            <FileText className="size-3.5" />
                            {receiptCount > 1 ? receiptCount : null}
                          </button>
                        ) : (
                          <span className="text-base-content/40">—</span>
                        )}
                      </td>
                      <td>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs btn-square"
                            aria-label="Edit expense"
                            disabled={busy}
                            onClick={() => startEdit(row)}
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs btn-square text-error"
                            aria-label="Delete expense"
                            disabled={busy}
                            onClick={() => void handleDelete(row.id)}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
