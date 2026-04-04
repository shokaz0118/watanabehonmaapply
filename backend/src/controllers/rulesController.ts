import { createRuleService, listRulesService, type CreateRuleInput } from "../services/ruleService";
import type { RuleRecord } from "../repositories/ruleRepository";

// Controller は「HTTPの入口」です。
// req（受け取り）と res（返し）を扱います。
// 細かい業務ルールは Service に任せます。

// このAPIで使う req の最小形。
type RequestLike = {
  body?: CreateRuleInput;
};

// このAPIで使う res の最小形。
// status(...).json(...) でつなげて返せるようにしています。
type ResponseLike = {
  status: (code: number) => ResponseLike;
  json: (payload: unknown) => ResponseLike;
};

// DB形式（camelCase）を API形式（snake_case）へ変換する関数です。
// フロントへ返す前に、名前ルールを統一するために使います。
function toRuleResponse(rule: RuleRecord) {
  return {
    id: rule.id,
    theme: rule.theme,
    time: rule.time,
    frequency: rule.frequency,
    is_enabled: rule.isEnabled,
    created_at: rule.createdAt,
    updated_at: rule.updatedAt,
  };
}

// 通知ルールを1件作るAPIです。
export async function createRule(req: RequestLike, res: ResponseLike): Promise<ResponseLike> {
  try {
    // body がない場合でも安全に動かせるように空オブジェクトを渡します。
    const created = await createRuleService(req.body || {});

    // Service から null が返ったら入力エラーです。
    if (!created) {
      return res.status(400).json({ error: "Invalid input" });
    }

    // 正常時は作成結果をAPI形式にして返します。
    return res.json(toRuleResponse(created));
  } catch (_error) {
    // 想定外エラー（DB障害など）は 500。
    return res.status(500).json({ error: "Internal server error" });
  }
}

// 通知ルール一覧を返すAPIです。
export async function listRules(_req: RequestLike, res: ResponseLike): Promise<ResponseLike> {
  try {
    // 一覧をServiceから受け取ります（並び順はService/Repository側の責務）。
    const rules = await listRulesService();

    // 配列の各要素をAPI形式に変換して返します。
    return res.json(rules.map((rule) => toRuleResponse(rule)));
  } catch (_error) {
    // 想定外エラー（DB障害など）は 500。
    return res.status(500).json({ error: "Internal server error" });
  }
}
