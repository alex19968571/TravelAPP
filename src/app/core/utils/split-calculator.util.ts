import { ExpenseSplit } from '../models';
import { generateId } from './uuid.util';

// 精度：以整數 10000 倍運算，避免浮點誤差
const PRECISION = 10000;

export function calcEqualSplits(
  expenseId: string,
  memberIds: string[],
  payerMemberId: string,
  totalAmount: number,
  convertedTotal: number,
  exchangeRate: number
): ExpenseSplit[] {
  if (memberIds.length === 0) return [];

  const base = Math.floor((totalAmount / memberIds.length) * PRECISION) / PRECISION;
  const splits: ExpenseSplit[] = memberIds.map(memberId => ({
    id: generateId(),
    expense_id: expenseId,
    member_id: memberId,
    owed_amount: base,
    converted_owed_amount: Math.floor(base * exchangeRate * PRECISION) / PRECISION,
    share_weight: 1.0,
  }));

  // 尾差加回墊款人，確保帳面零誤差
  const sumOwed = splits.reduce((acc, s) => acc + s.owed_amount, 0);
  const remainder = Math.round((totalAmount - sumOwed) * PRECISION) / PRECISION;
  const payerSplit = splits.find(s => s.member_id === payerMemberId);
  if (payerSplit && Math.abs(remainder) > 0) {
    payerSplit.owed_amount = Math.round((payerSplit.owed_amount + remainder) * PRECISION) / PRECISION;
    payerSplit.converted_owed_amount = Math.round(payerSplit.owed_amount * exchangeRate * PRECISION) / PRECISION;
  }

  return splits;
}

export function calcShareSplits(
  expenseId: string,
  shares: { memberId: string; weight: number }[],
  payerMemberId: string,
  totalAmount: number,
  exchangeRate: number
): ExpenseSplit[] {
  const totalWeight = shares.reduce((s, m) => s + m.weight, 0);
  const splits: ExpenseSplit[] = shares.map(({ memberId, weight }) => {
    const owed = Math.floor((totalAmount * weight / totalWeight) * PRECISION) / PRECISION;
    return {
      id: generateId(),
      expense_id: expenseId,
      member_id: memberId,
      owed_amount: owed,
      converted_owed_amount: Math.floor(owed * exchangeRate * PRECISION) / PRECISION,
      share_weight: weight,
    };
  });

  // 尾差加回墊款人
  const sumOwed = splits.reduce((acc, s) => acc + s.owed_amount, 0);
  const remainder = Math.round((totalAmount - sumOwed) * PRECISION) / PRECISION;
  const payerSplit = splits.find(s => s.member_id === payerMemberId);
  if (payerSplit && Math.abs(remainder) > 0) {
    payerSplit.owed_amount = Math.round((payerSplit.owed_amount + remainder) * PRECISION) / PRECISION;
    payerSplit.converted_owed_amount = Math.round(payerSplit.owed_amount * exchangeRate * PRECISION) / PRECISION;
  }

  return splits;
}
