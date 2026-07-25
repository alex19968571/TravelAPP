import { Injectable, inject } from '@angular/core';
import { db } from '../db/local.db';
import { SyncEngineService } from './sync-engine.service';
import { Expense, ExpenseSplit, TripMember } from '../models';
import { generateId } from '../utils/uuid.util';
import { calcEqualSplits, calcShareSplits } from '../utils/split-calculator.util';

export interface CreateExpenseDto {
  trip_id: string;
  title: string;
  amount: number;
  currency_code: string;
  exchange_rate: number;
  expense_date_utc: string;
  payer_member_id: string;
  split_type: 'EQUAL' | 'EXACT' | 'SHARES';
  members: TripMember[];
  receipt_image_url?: string;
  ocr_raw_data?: Record<string, unknown>;
  exact_splits?: { memberId: string; amount: number }[];
  share_weights?: { memberId: string; weight: number }[];
}

@Injectable({ providedIn: 'root' })
export class ExpenseService {
  private sync = inject(SyncEngineService);

  async getByTrip(tripId: string): Promise<Expense[]> {
    return db.expenses.where('trip_id').equals(tripId)
      .sortBy('expense_date_utc').then(r => r.reverse());
  }

  async getSplits(expenseId: string): Promise<ExpenseSplit[]> {
    return db.expense_splits.where('expense_id').equals(expenseId).toArray();
  }

  async create(dto: CreateExpenseDto): Promise<Expense> {
    const expenseId = generateId();
    const convertedAmount = dto.amount * dto.exchange_rate;
    const now = new Date().toISOString();

    const expense: Expense = {
      client_record_id: expenseId,
      trip_id: dto.trip_id,
      title: dto.title,
      amount: dto.amount,
      currency_code: dto.currency_code,
      exchange_rate: dto.exchange_rate,
      converted_amount: convertedAmount,
      expense_date_utc: dto.expense_date_utc,
      payer_member_id: dto.payer_member_id,
      split_type: dto.split_type,
      receipt_image_url: dto.receipt_image_url,
      ocr_raw_data: dto.ocr_raw_data,
      updated_at_utc: now,
    };

    let splits: ExpenseSplit[] = [];
    const memberIds = dto.members.map(m => m.id);

    if (dto.split_type === 'EQUAL') {
      splits = calcEqualSplits(
        expenseId, memberIds, dto.payer_member_id,
        dto.amount, convertedAmount, dto.exchange_rate
      );
    } else if (dto.split_type === 'SHARES' && dto.share_weights) {
      splits = calcShareSplits(
        expenseId, dto.share_weights, dto.payer_member_id,
        dto.amount, dto.exchange_rate
      );
    } else if (dto.split_type === 'EXACT' && dto.exact_splits) {
      splits = dto.exact_splits.map(({ memberId, amount }) => ({
        id: generateId(),
        expense_id: expenseId,
        member_id: memberId,
        owed_amount: amount,
        converted_owed_amount: amount * dto.exchange_rate,
        share_weight: 1.0,
      }));
    }

    await db.transaction('rw', [db.expenses, db.expense_splits], async () => {
      await db.expenses.add(expense);
      if (splits.length) await db.expense_splits.bulkAdd(splits);
    });

    await this.sync.enqueue('CREATE', 'expenses', expense as unknown as Record<string, unknown>);
    for (const split of splits) {
      await this.sync.enqueue('CREATE', 'expense_splits', split as unknown as Record<string, unknown>);
    }

    return expense;
  }

  async delete(id: string): Promise<void> {
    await db.transaction('rw', [db.expenses, db.expense_splits], async () => {
      await db.expense_splits.where('expense_id').equals(id).delete();
      await db.expenses.delete(id);
    });
    await this.sync.enqueue('DELETE', 'expenses', { client_record_id: id });
  }

  // 計算各成員應收/應付淨額（正數 = 需收回，負數 = 需支付）
  async calcSettlement(tripId: string): Promise<Map<string, number>> {
    const expenses = await this.getByTrip(tripId);
    const balance = new Map<string, number>();

    for (const exp of expenses) {
      const splits = await this.getSplits(exp.client_record_id);
      // 墊款人收回所有應付款
      balance.set(exp.payer_member_id,
        (balance.get(exp.payer_member_id) ?? 0) + exp.converted_amount);

      for (const split of splits) {
        balance.set(split.member_id,
          (balance.get(split.member_id) ?? 0) - split.converted_owed_amount);
      }
    }

    return balance;
  }
}
