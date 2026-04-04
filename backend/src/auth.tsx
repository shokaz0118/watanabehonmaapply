// このファイルは「互換用の入口」です。
// 既存の import パス（./auth）を壊さずに、
// 実体は controllers/authController から読み込んでいます。
export { login, register } from "./controllers/authController";
