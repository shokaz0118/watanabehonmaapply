// このファイルは「互換用の入口」です。
// 以前の import パス（./rules）を残したまま、
// 実体は controllers/rulesController から読み込むようにしています。
//
// つまり、このファイル自身はロジックを持ちません。
// 責任は「古い参照を壊さないこと」だけです。
//
// 実際の責任分担:
// - controllers/rulesController: HTTPの受け渡し
// - services/ruleService: 入力チェックと業務ルール
// - repositories/ruleRepository: DBアクセス
export { createRule, listRules, updateRule } from "./controllers/rulesController";
