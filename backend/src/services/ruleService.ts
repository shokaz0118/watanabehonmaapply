import {
  createRuleRecord,
  findRuleRecordById,
  listRuleRecords,
  type RuleRecord,
  updateRuleRecordById,
  type UpdateRuleRepositoryInput,
} from "../repositories/ruleRepository";

// Service は「業務ルール」を書く場所です。
// 例: 入力チェック、既定値の補完、文字の整形など。
// DBそのものの操作は Repository に任せます。
//
// このファイルの責任範囲（ここでやること）:
// 1. 受け取った値が仕様どおりかチェック
// 2. DBへ渡す前に値を整える（trim、既定値など）
// 3. Repositoryを呼ぶ順番を制御する
// 4. Controllerが使いやすい結果型に変換する
//
// このファイルで「やらないこと」:
// - HTTPステータスを決めること（Controllerの仕事）
// - SQL/Prismaクエリを書くこと（Repositoryの仕事）

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

export type UpdateRuleInput = {
  // id はURLパラメータ由来、他はbody由来です。
  id?: unknown;
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

function isValidId(value: unknown): value is string {
  // id は「空でない文字列」だけ受け付けます。
  return typeof value === "string" && value.trim().length > 0;
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
  // Repositoryは "どう保存するか" を担当。
  // Serviceは "いつ保存するか" を担当。
  return createRuleRecord(normalized);
}

// ルール一覧取得の業務ロジック。
export async function listRulesService(): Promise<RuleRecord[]> {
  // 取得の詳細（orderBy）は Repository 側に集約しています。
  // ここは呼び出しだけにして、DBの知識をServiceに持ち込まないようにします。
  return listRuleRecords();
}

export type UpdateRuleServiceResult =
  | {
      ok: true;
      data: RuleRecord;
    }
  | {
      ok: false;
      error: "INVALID_INPUT" | "NOT_FOUND";
    };

function buildUpdateData(input: UpdateRuleInput): UpdateRuleRepositoryInput | null {
  // この関数の目的:
  // 「更新可能な値だけ」を抜き出して、DB更新用オブジェクトを作ること。
  // 不正な値が1つでもあれば null を返し、更新処理を止めます。
  const updateData: UpdateRuleRepositoryInput = {};

  if (input.theme !== undefined) {
    // theme が渡されたときだけチェック＆更新対象に入れる
    if (!isNonEmptyString(input.theme)) {
      return null;
    }
    updateData.theme = input.theme.trim();
  }

  if (input.time !== undefined) {
    // time は HH:mm 形式だけOK
    if (!isValidTime(input.time)) {
      return null;
    }
    updateData.time = input.time;
  }

  if (input.frequency !== undefined) {
    // frequency は許可値だけOK
    if (!isValidFrequency(input.frequency)) {
      return null;
    }
    updateData.frequency = input.frequency;
  }

  if (input.is_enabled !== undefined) {
    // is_enabled は boolean だけOK
    if (typeof input.is_enabled !== "boolean") {
      return null;
    }
    updateData.isEnabled = input.is_enabled;
  }

  // 1項目も更新対象がないなら不正入力扱い
  if (Object.keys(updateData).length === 0) {
    return null;
  }

  return updateData;
}

// ルール更新の業務ロジック。
// - 入力不正: INVALID_INPUT
// - 対象なし: NOT_FOUND
// - 成功: 更新後データ
export async function updateRuleService(input: UpdateRuleInput): Promise<UpdateRuleServiceResult> {
  // 1. id の基本チェック
  if (!isValidId(input.id)) {
    return { ok: false, error: "INVALID_INPUT" };
  }

  // 2. 余計な空白を削って正規化
  const id = input.id.trim();

  // 3. 更新内容のチェックと正規化
  const updateData = buildUpdateData(input);
  if (!updateData) {
    return { ok: false, error: "INVALID_INPUT" };
  }

  // 4. 先に存在確認（存在しないIDを更新しない）
  const existing = await findRuleRecordById(id);
  if (!existing) {
    return { ok: false, error: "NOT_FOUND" };
  }

  // 5. 実更新
  const updated = await updateRuleRecordById(id, updateData);

  // 6. 成功結果を返す
  return { ok: true, data: updated };
}
