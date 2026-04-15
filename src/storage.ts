import { payments } from "./data";
import type { PaymentEntry } from "./types";

const STORAGE_KEY = "project-finance-payments";
const SOURCE_PATH = "/payments.json";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readPayments() {
  if (!canUseStorage()) {
    return payments;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payments));
    return payments;
  }

  try {
    const parsed = JSON.parse(raw) as PaymentEntry[];
    return parsed;
  } catch {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payments));
    return payments;
  }
}

function writePayments(entries: PaymentEntry[]) {
  if (canUseStorage()) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }
}

export const paymentApi = {
  async getPayments() {
    if (!canUseStorage()) {
      return payments;
    }

    const existing = window.localStorage.getItem(STORAGE_KEY);

    if (existing) {
      return readPayments();
    }

    try {
      const response = await fetch(SOURCE_PATH, { cache: "no-store" });

      if (response.ok) {
        const remotePayments = (await response.json()) as PaymentEntry[];
        writePayments(remotePayments);
        return remotePayments;
      }
    } catch {
      return readPayments();
    }

    return readPayments();
  },
  async addPayment(entry: Omit<PaymentEntry, "id">) {
    const nextEntry: PaymentEntry = {
      ...entry,
      id: crypto.randomUUID()
    };
    const next = [...readPayments(), nextEntry];
    writePayments(next);
    return next;
  },
  async updatePayment(id: string, updates: Omit<PaymentEntry, "id">) {
    const next = readPayments().map((entry) =>
      entry.id === id ? { ...updates, id } : entry
    );
    writePayments(next);
    return next;
  },
  async deletePayment(id: string) {
    const next = readPayments().filter((entry) => entry.id !== id);
    writePayments(next);
    return next;
  },
  async importPayments(entries: PaymentEntry[]) {
    writePayments(entries);
    return entries;
  },
  async clearLocalCache() {
    if (canUseStorage()) {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    return this.getPayments();
  },
  exportPayments() {
    return readPayments();
  }
};
