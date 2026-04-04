// このファイルは「互換用の入口」です。
// 以前の import パス（./rules）を残したまま、
// 実体は controllers/rulesController から読み込むようにしています。
export { createRule, listRules } from "./controllers/rulesController";
