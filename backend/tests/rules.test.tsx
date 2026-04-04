import { beforeEach, describe, expect, jest, test } from "@jest/globals";

// これは「DBに保存する関数」をニセモノにするための箱です。
// 本物のDBは使わず、呼ばれたかどうかだけを調べます。
const mockRuleCreate = jest.fn<() => Promise<any>>();
const mockRuleFindMany = jest.fn<() => Promise<any>>();
const mockRuleFindUnique = jest.fn<() => Promise<any>>();
const mockRuleUpdate = jest.fn<() => Promise<any>>();
const mockRuleDelete = jest.fn<() => Promise<any>>();

// Prisma（DBに話しかける道具）を、テスト用のニセモノに差し替えます。
// こうすると、テスト中に本当にDBへ書き込まれません。
jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn(() => ({
    rule: {
      // rule.create が呼ばれたときは、上で作ったニセ関数を使います。
      create: mockRuleCreate,
      // rule.findMany が呼ばれたときは、一覧取得用のにせ関数を使います。
      findMany: mockRuleFindMany,
      // 更新API用: id検索のにせ関数です。
      findUnique: mockRuleFindUnique,
      // 更新API用: updateのにせ関数です。
      update: mockRuleUpdate,
      // 削除API用: deleteのにせ関数です。
      delete: mockRuleDelete,
    },
  })),
}));

// テストしたい本体の関数を読み込みます。
const { createRule, listRules, updateRule, deleteRule } = require("../src/rules");

function createMockRes() {
  // API は res.status(...).json(...) のように返します。
  // その動きをマネするため、resのニセモノを作ります。
  const res: any = {};

  // status が呼ばれたかどうかを記録しつつ、
  // つづけて json を呼べるように自分自身を返します。
  res.status = jest.fn(() => res);

  // json がどんなデータで呼ばれたか記録します。
  res.json = jest.fn(() => res);

  // 204 No Content で本文なし終了するときに使う関数です。
  res.end = jest.fn(() => res);
  return res;
}

// describe は「このかたまりは何のテストか」を表す見出しです。
describe("createRule（通知ルール作成API）", () => {
  beforeEach(() => {
    // テストごとに記録をリセットしないと、
    // 前のテストの結果が残ってしまうので毎回消します。
    jest.clearAllMocks();
  });

  // 1つ目: 必須項目が足りないときのテスト
  test("theme が未指定なら 400 を返し、DB保存しない", async () => {
    // わざと theme を入れないデータを作ります。
    const req = {
      body: {
        time: "15:00",
        frequency: "daily",
        is_enabled: true,
      },
    };

    // 返り値用のニセresを作ります。
    const res = createMockRes();

    // 実際に API の関数を実行します。
    await createRule(req, res);

    // 入力が不正なので、HTTP 400（入力ミス）になるはず。
    expect(res.status).toHaveBeenCalledWith(400);

    // エラーメッセージも期待どおりか確認します。
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid input" });

    // 入力が不正なら、DB保存は呼ばれてはいけません。
    expect(mockRuleCreate).not.toHaveBeenCalled();
  });

  // 2つ目: time の書き方が間違っているときのテスト
  test("time が HH:mm 形式でなければ 400 を返し、DB保存しない", async () => {
    // わざと 3pm という形式を入れて、エラーになるか確認します。
    const req = {
      body: {
        theme: "名言",
        time: "3pm",
        frequency: "daily",
        is_enabled: true,
      },
    };
    const res = createMockRes();

    await createRule(req, res);

    // 形式エラーなので 400 を返すはずです。
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid input" });

    // こちらもDB保存はしてはいけません。
    expect(mockRuleCreate).not.toHaveBeenCalled();
  });

  // 3つ目: 正しい入力なら保存して、APIの返却形式で返すテスト
  test("入力が正しければルールを保存し、API形式（snake_case）で返す", async () => {
    // 今度は正しいデータを用意します。
    const req = {
      body: {
        theme: "名言",
        time: "15:00",
        frequency: "daily",
        is_enabled: true,
      },
    };
    const res = createMockRes();

    // DB保存が成功したときに返ってくる想定データです。
    const createdRule = {
      id: "rule_1",
      theme: "名言",
      time: "15:00",
      frequency: "daily",
      isEnabled: true,
      createdAt: new Date("2026-04-04T15:00:00.000Z"),
      updatedAt: new Date("2026-04-04T15:00:00.000Z"),
    };

    // 「DBがこのデータを返したことにする」と設定します。
    mockRuleCreate.mockResolvedValue(createdRule);

    // API実行
    await createRule(req, res);

    // API入力の is_enabled は Prisma 側の isEnabled に変換して保存する
    // 変換ができているか、渡したデータを細かく確認します。
    expect(mockRuleCreate).toHaveBeenCalledWith({
      data: {
        theme: "名言",
        time: "15:00",
        frequency: "daily",
        isEnabled: true,
      },
    });

    // 正常時は status を明示的に呼ばず、200扱いで json を返します。
    expect(res.status).not.toHaveBeenCalled();

    // 返却値はAPI形式（snake_case）になっているか確認します。
    expect(res.json).toHaveBeenCalledWith({
      id: "rule_1",
      theme: "名言",
      time: "15:00",
      frequency: "daily",
      is_enabled: true,
      created_at: new Date("2026-04-04T15:00:00.000Z"),
      updated_at: new Date("2026-04-04T15:00:00.000Z"),
    });
  });

  // 4つ目: APIの返却形式（snake_case）を守れているか確認するテスト
  test("成功時のレスポンスは is_enabled を返し、isEnabled を返さない", async () => {
    const req = {
      body: {
        theme: "名言",
        time: "15:00",
        frequency: "daily",
      },
    };
    const res = createMockRes();

    const createdRule = {
      id: "rule_2",
      theme: "名言",
      time: "15:00",
      frequency: "daily",
      isEnabled: true,
      createdAt: new Date("2026-04-04T15:00:00.000Z"),
      updatedAt: new Date("2026-04-04T15:00:00.000Z"),
    };

    mockRuleCreate.mockResolvedValue(createdRule);

    await createRule(req, res);

    // APIレスポンスは camelCase ではなく snake_case を使う方針
    expect(res.json).toHaveBeenCalledWith({
      id: "rule_2",
      theme: "名言",
      time: "15:00",
      frequency: "daily",
      is_enabled: true,
      created_at: new Date("2026-04-04T15:00:00.000Z"),
      updated_at: new Date("2026-04-04T15:00:00.000Z"),
    });
  });

  // 5つ目: frequency が許可値でなければエラーにするテスト
  test("frequency が許可されていない値なら 400 を返し、DB保存しない", async () => {
    const req = {
      body: {
        theme: "名言",
        time: "15:00",
        frequency: "everyday",
        is_enabled: true,
      },
    };
    const res = createMockRes();

    await createRule(req, res);

    // frequency が不正なので 400
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid input" });
    expect(mockRuleCreate).not.toHaveBeenCalled();
  });

  // 6つ目: is_enabled を省略したときの既定値（true）を確認するテスト
  test("is_enabled が未指定なら true として保存する", async () => {
    const req = {
      body: {
        theme: "名言",
        time: "15:00",
        frequency: "daily",
      },
    };
    const res = createMockRes();

    const createdRule = {
      id: "rule_3",
      theme: "名言",
      time: "15:00",
      frequency: "daily",
      isEnabled: true,
      createdAt: new Date("2026-04-04T15:00:00.000Z"),
      updatedAt: new Date("2026-04-04T15:00:00.000Z"),
    };

    mockRuleCreate.mockResolvedValue(createdRule);

    await createRule(req, res);

    // 未指定時は true で保存されることを確認
    expect(mockRuleCreate).toHaveBeenCalledWith({
      data: {
        theme: "名言",
        time: "15:00",
        frequency: "daily",
        isEnabled: true,
      },
    });
  });

  // 7つ目: theme の前後スペースを削って保存するテスト
  test("theme の前後空白は削って保存する", async () => {
    const req = {
      body: {
        theme: "  名言  ",
        time: "15:00",
        frequency: "daily",
        is_enabled: true,
      },
    };
    const res = createMockRes();

    const createdRule = {
      id: "rule_4",
      theme: "名言",
      time: "15:00",
      frequency: "daily",
      isEnabled: true,
      createdAt: new Date("2026-04-04T15:00:00.000Z"),
      updatedAt: new Date("2026-04-04T15:00:00.000Z"),
    };

    mockRuleCreate.mockResolvedValue(createdRule);

    await createRule(req, res);

    // DB保存時の theme が trim 済みか確認
    expect(mockRuleCreate).toHaveBeenCalledWith({
      data: {
        theme: "名言",
        time: "15:00",
        frequency: "daily",
        isEnabled: true,
      },
    });
  });

  // 8つ目: DBエラー時に 500 を返すテスト
  test("DB保存で例外が起きたら 500 を返す", async () => {
    const req = {
      body: {
        theme: "名言",
        time: "15:00",
        frequency: "daily",
        is_enabled: true,
      },
    };
    const res = createMockRes();

    // DB側の失敗を再現
    mockRuleCreate.mockRejectedValue(new Error("db error"));

    await createRule(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
  });
});

describe("listRules（通知ルール一覧API）", () => {
  beforeEach(() => {
    // 前のテスト記録を毎回消して、まざらないようにします。
    jest.clearAllMocks();
  });

  test("データが0件なら空配列を返す", async () => {
    const req = {};
    const res = createMockRes();

    mockRuleFindMany.mockResolvedValue([]);

    await listRules(req, res);

    // 0件のときは [] をそのまま返す。
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith([]);
  });

  test("ルール一覧を新しい順で取得し、API形式（snake_case）で返す", async () => {
    const req = {};
    const res = createMockRes();

    const rules = [
      {
        id: "rule_new",
        theme: "名言",
        time: "18:00",
        frequency: "daily",
        isEnabled: true,
        createdAt: new Date("2026-04-05T10:00:00.000Z"),
        updatedAt: new Date("2026-04-05T10:00:00.000Z"),
      },
      {
        id: "rule_old",
        theme: "学習",
        time: "07:00",
        frequency: "weekdays",
        isEnabled: false,
        createdAt: new Date("2026-04-01T10:00:00.000Z"),
        updatedAt: new Date("2026-04-01T10:00:00.000Z"),
      },
    ];

    mockRuleFindMany.mockResolvedValue(rules);

    await listRules(req, res);

    // DBへは createdAt の新しい順で取得する指定を出す
    expect(mockRuleFindMany).toHaveBeenCalledWith({
      orderBy: {
        createdAt: "desc",
      },
    });

    // 正常時は status を明示せず、200扱いで json を返す。
    expect(res.status).not.toHaveBeenCalled();

    // APIで返すときは snake_case にそろえる
    expect(res.json).toHaveBeenCalledWith([
      {
        id: "rule_new",
        theme: "名言",
        time: "18:00",
        frequency: "daily",
        is_enabled: true,
        created_at: new Date("2026-04-05T10:00:00.000Z"),
        updated_at: new Date("2026-04-05T10:00:00.000Z"),
      },
      {
        id: "rule_old",
        theme: "学習",
        time: "07:00",
        frequency: "weekdays",
        is_enabled: false,
        created_at: new Date("2026-04-01T10:00:00.000Z"),
        updated_at: new Date("2026-04-01T10:00:00.000Z"),
      },
    ]);
  });

  test("成功レスポンスに camelCase キーを混ぜない", async () => {
    const req = {};
    const res = createMockRes();

    mockRuleFindMany.mockResolvedValue([
      {
        id: "rule_check",
        theme: "名言",
        time: "20:00",
        frequency: "daily",
        isEnabled: true,
        createdAt: new Date("2026-04-06T10:00:00.000Z"),
        updatedAt: new Date("2026-04-06T10:00:00.000Z"),
      },
    ]);

    await listRules(req, res);

    const payload = res.json.mock.calls[0][0];

    // API契約として snake_case を強制する。
    expect(payload[0].is_enabled).toBe(true);
    expect(payload[0].created_at).toBeInstanceOf(Date);
    expect(payload[0].updated_at).toBeInstanceOf(Date);
    expect(payload[0].isEnabled).toBeUndefined();
    expect(payload[0].createdAt).toBeUndefined();
    expect(payload[0].updatedAt).toBeUndefined();
  });

  test("一覧取得で例外が起きたら 500 を返す", async () => {
    const req = {};
    const res = createMockRes();

    mockRuleFindMany.mockRejectedValue(new Error("db error"));

    await listRules(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
  });
});

describe("updateRule（通知ルール更新API）", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("id が無いなら 400 を返す", async () => {
    const req = {
      params: {},
      body: {
        theme: "更新後テーマ",
      },
    };
    const res = createMockRes();

    await updateRule(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid input" });
  });

  test("更新項目が1つも無いなら 400 を返す", async () => {
    const req = {
      params: { id: "rule_1" },
      body: {},
    };
    const res = createMockRes();

    await updateRule(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid input" });
    expect(mockRuleFindUnique).not.toHaveBeenCalled();
  });

  test("time が不正形式なら 400 を返す", async () => {
    const req = {
      params: { id: "rule_1" },
      body: {
        time: "3pm",
      },
    };
    const res = createMockRes();

    await updateRule(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid input" });
    expect(mockRuleFindUnique).not.toHaveBeenCalled();
  });

  test("対象IDが存在しないなら 404 を返す", async () => {
    const req = {
      params: { id: "rule_missing" },
      body: {
        theme: "更新後テーマ",
      },
    };
    const res = createMockRes();

    mockRuleFindUnique.mockResolvedValue(null);

    await updateRule(req, res);

    expect(mockRuleFindUnique).toHaveBeenCalledWith({
      where: {
        id: "rule_missing",
      },
    });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Not found" });
    expect(mockRuleUpdate).not.toHaveBeenCalled();
  });

  test("入力が正しければ更新し、snake_case で返す", async () => {
    const req = {
      params: { id: "rule_1" },
      body: {
        theme: "  新しい名言  ",
        time: "16:30",
        frequency: "weekdays",
        is_enabled: false,
      },
    };
    const res = createMockRes();

    mockRuleFindUnique.mockResolvedValue({
      id: "rule_1",
      theme: "旧テーマ",
      time: "15:00",
      frequency: "daily",
      isEnabled: true,
      createdAt: new Date("2026-04-01T10:00:00.000Z"),
      updatedAt: new Date("2026-04-01T10:00:00.000Z"),
    });

    mockRuleUpdate.mockResolvedValue({
      id: "rule_1",
      theme: "新しい名言",
      time: "16:30",
      frequency: "weekdays",
      isEnabled: false,
      createdAt: new Date("2026-04-01T10:00:00.000Z"),
      updatedAt: new Date("2026-04-07T09:00:00.000Z"),
    });

    await updateRule(req, res);

    expect(mockRuleUpdate).toHaveBeenCalledWith({
      where: {
        id: "rule_1",
      },
      data: {
        theme: "新しい名言",
        time: "16:30",
        frequency: "weekdays",
        isEnabled: false,
      },
    });
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      id: "rule_1",
      theme: "新しい名言",
      time: "16:30",
      frequency: "weekdays",
      is_enabled: false,
      created_at: new Date("2026-04-01T10:00:00.000Z"),
      updated_at: new Date("2026-04-07T09:00:00.000Z"),
    });
  });

  test("更新中に例外が起きたら 500 を返す", async () => {
    const req = {
      params: { id: "rule_1" },
      body: {
        theme: "更新後テーマ",
      },
    };
    const res = createMockRes();

    mockRuleFindUnique.mockRejectedValue(new Error("db error"));

    await updateRule(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
  });
});

describe("deleteRule（通知ルール削除API）", () => {
  beforeEach(() => {
    // テスト同士の記録が混ざらないように毎回リセットします。
    jest.clearAllMocks();
  });

  test("id が無いなら 400 を返す", async () => {
    const req = {
      params: {},
    };
    const res = createMockRes();

    await deleteRule(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid input" });
    expect(mockRuleFindUnique).not.toHaveBeenCalled();
    expect(mockRuleDelete).not.toHaveBeenCalled();
  });

  test("対象IDが存在しないなら 404 を返す", async () => {
    const req = {
      params: {
        id: "rule_missing",
      },
    };
    const res = createMockRes();

    mockRuleFindUnique.mockResolvedValue(null);

    await deleteRule(req, res);

    expect(mockRuleFindUnique).toHaveBeenCalledWith({
      where: {
        id: "rule_missing",
      },
    });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Not found" });
    expect(mockRuleDelete).not.toHaveBeenCalled();
  });

  test("存在するIDなら削除して 204 で終了する", async () => {
    const req = {
      params: {
        id: "rule_1",
      },
    };
    const res = createMockRes();

    mockRuleFindUnique.mockResolvedValue({
      id: "rule_1",
      theme: "名言",
      time: "15:00",
      frequency: "daily",
      isEnabled: true,
      createdAt: new Date("2026-04-01T10:00:00.000Z"),
      updatedAt: new Date("2026-04-01T10:00:00.000Z"),
    });
    mockRuleDelete.mockResolvedValue({
      id: "rule_1",
    });

    await deleteRule(req, res);

    expect(mockRuleDelete).toHaveBeenCalledWith({
      where: {
        id: "rule_1",
      },
    });
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.end).toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  test("削除中に例外が起きたら 500 を返す", async () => {
    const req = {
      params: {
        id: "rule_1",
      },
    };
    const res = createMockRes();

    mockRuleFindUnique.mockRejectedValue(new Error("db error"));

    await deleteRule(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
  });
});
