import { createRuleRecord, listRuleRecords, type RuleRecord } from "../repositories/ruleRepository";

// Service は「業務ルール」を書く場所です。
// 例: 入力チェック、既定値の補完、文字の整形など。
// DBそのものの操作は Repository に任せます。

// frequency で許可する値のリストです。
// ここにない値が来たらエラーにします。
const ALLOWED_FREQUENCIES = new Set(["daily", "weekdays", "weekly"]);

// 時刻の形式チェック用。
// 24時間の HH:mm（例: 07:30, 18:00）だけOKにします。
const TIME_24H_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

// Controller から受け取る入力の形です。
// まだ信用しないので unknown を使い、後で自前でチェックします。
export type CreateRuleInput = {
  theme?: unknown;
  time?: unknown;
  frequency?: unknown;
  is_enabled?: unknown;
};

// 入力チェックを通過した後の「安全な形」です。
// ここまで来ると theme/time/frequency/isEnabled が必ず入っています。
type CreateRuleValidInput = {
  theme: string;
  time: string;
  frequency: string;
  isEnabled: boolean;
};

// 文字がちゃんと入っているかを確認します。
// 空白だけ（"   "）は NG にします。
function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

// HH:mm の形かどうかを確認します。
function isValidTime(value: unknown): value is string {
  return typeof value === "string" && TIME_24H_REGEX.test(value);
}

// frequency が許可リスト内か確認します。
function isValidFrequency(value: unknown): value is string {
  return typeof value === "string" && ALLOWED_FREQUENCIES.has(value);
}

// Controller から来た入力を「保存可能な形」に整える関数です。
// 不正な値があれば null を返し、呼び出し元に「エラー扱い」を伝えます。
function normalizeCreateRuleInput(input: CreateRuleInput): CreateRuleValidInput | null {
  const { theme, time, frequency, is_enabled: isEnabledInput } = input;

  // 1つでもルール違反があれば null を返します。
  if (!isNonEmptyString(theme) || !isValidTime(time) || !isValidFrequency(frequency)) {
    return null;
  }

  // theme は前後の空白を削除して保存します。
  // is_enabled が未指定なら true を既定値にします。
  return {
    theme: theme.trim(),
    time,
    frequency,
    isEnabled: typeof isEnabledInput === "boolean" ? isEnabledInput : true,
  };
}

// ルール作成の業務ロジック。
// 入力が不正なら null を返します。
export async function createRuleService(input: CreateRuleInput): Promise<RuleRecord | null> {
  // まず入力を正しい形に整えます。
  const normalized = normalizeCreateRuleInput(input);
  if (!normalized) {
    // 入力が正しくなければ、Controller 側で 400 を返してもらいます。
    return null;
  }

  // 正しい入力だけを Repository に渡してDB保存します。
  return createRuleRecord(normalized);
}

// ルール一覧取得の業務ロジック。
export async function listRulesService(): Promise<RuleRecord[]> {
  // 取得の詳細（orderBy）は Repository 側に集約しています。
  return listRuleRecords();
}
