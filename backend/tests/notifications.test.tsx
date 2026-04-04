import { beforeEach, describe, expect, jest, test } from "@jest/globals";

// ここでは Prisma をまるごとにせものにして、
// DBに実際には書き込まないでテストします。
const mockRuleFindUnique = jest.fn<() => Promise<any>>();
const mockNotificationCreate = jest.fn<() => Promise<any>>();
const mockNotificationFindMany = jest.fn<() => Promise<any>>();
const mockNotificationFindUnique = jest.fn<() => Promise<any>>();
const mockNotificationUpdate = jest.fn<() => Promise<any>>();

jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn(() => ({
    rule: {
      // ルール存在確認で使うにせ関数
      findUnique: mockRuleFindUnique,
    },
    notification: {
      // 通知保存で使うにせ関数
      create: mockNotificationCreate,
      // 通知一覧取得で使うにせ関数
      findMany: mockNotificationFindMany,
      // 通知1件取得で使うにせ関数
      findUnique: mockNotificationFindUnique,
      // 通知更新で使うにせ関数
      update: mockNotificationUpdate,
    },
  })),
}));

const { generateNotification, listNotifications, markNotificationAsRead } = require("../src/notifications");

function createMockRes() {
  // Express の res を最小限だけまねします。
  const res: any = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

describe("generateNotification（通知生成API）", () => {
  beforeEach(() => {
    // 前のテスト記録を消して、テスト同士が混ざらないようにします。
    jest.clearAllMocks();
  });

  test("rule_id が無ければ 400 を返す", async () => {
    const req = {
      body: {},
    };
    const res = createMockRes();

    await generateNotification(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid input" });
    expect(mockRuleFindUnique).not.toHaveBeenCalled();
    expect(mockNotificationCreate).not.toHaveBeenCalled();
  });

  test("対象ルールが存在しなければ 404 を返す", async () => {
    const req = {
      body: {
        rule_id: "rule_missing",
      },
    };
    const res = createMockRes();

    mockRuleFindUnique.mockResolvedValue(null);

    await generateNotification(req, res);

    expect(mockRuleFindUnique).toHaveBeenCalledWith({
      where: {
        id: "rule_missing",
      },
    });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Not found" });
    expect(mockNotificationCreate).not.toHaveBeenCalled();
  });

  test("ルールが存在すれば通知を1件作って snake_case で返す", async () => {
    const req = {
      body: {
        rule_id: "rule_1",
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

    mockNotificationCreate.mockResolvedValue({
      id: "notif_1",
      ruleId: "rule_1",
      scheduledDate: new Date("2026-04-08T15:00:00.000Z"),
      shortText: "継続は力なり。今日の一歩が未来を変える。",
      description: "大きな成果は、毎日の小さな積み重ねから生まれます。",
      actionSuggestion: "今日は5分だけでも、やると決めたことを続けてみましょう。",
      isRead: false,
      createdAt: new Date("2026-04-08T15:00:00.000Z"),
    });

    await generateNotification(req, res);

    expect(mockNotificationCreate).toHaveBeenCalledWith({
      data: {
        ruleId: "rule_1",
        scheduledDate: expect.any(Date),
        shortText: "継続は力なり。今日の一歩が未来を変える。",
        description: "大きな成果は、毎日の小さな積み重ねから生まれます。",
        actionSuggestion: "今日は5分だけでも、やると決めたことを続けてみましょう。",
        isRead: false,
      },
    });

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      id: "notif_1",
      rule_id: "rule_1",
      scheduled_date: new Date("2026-04-08T15:00:00.000Z"),
      short_text: "継続は力なり。今日の一歩が未来を変える。",
      description: "大きな成果は、毎日の小さな積み重ねから生まれます。",
      action_suggestion: "今日は5分だけでも、やると決めたことを続けてみましょう。",
      is_read: false,
      created_at: new Date("2026-04-08T15:00:00.000Z"),
    });
  });

  test("通知生成中に例外が起きたら 500 を返す", async () => {
    const req = {
      body: {
        rule_id: "rule_1",
      },
    };
    const res = createMockRes();

    mockRuleFindUnique.mockRejectedValue(new Error("db error"));

    await generateNotification(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
  });
});

describe("listNotifications（通知一覧API）", () => {
  beforeEach(() => {
    // テストの記録が混ざらないように毎回リセット
    jest.clearAllMocks();
  });

  test("データが0件なら空配列を返す", async () => {
    const req = {
      query: {},
    };
    const res = createMockRes();

    mockNotificationFindMany.mockResolvedValue([]);

    await listNotifications(req, res);

    expect(mockNotificationFindMany).toHaveBeenCalledWith({
      orderBy: {
        createdAt: "desc",
      },
      skip: 0,
      take: 20,
    });
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith([]);
  });

  test("通知一覧を新しい順で取得し、snake_caseで返す", async () => {
    const req = {
      query: {},
    };
    const res = createMockRes();

    mockNotificationFindMany.mockResolvedValue([
      {
        id: "notif_new",
        ruleId: "rule_1",
        scheduledDate: new Date("2026-04-08T15:00:00.000Z"),
        shortText: "新しい通知",
        description: "説明A",
        actionSuggestion: "提案A",
        isRead: false,
        createdAt: new Date("2026-04-08T15:00:00.000Z"),
      },
      {
        id: "notif_old",
        ruleId: "rule_2",
        scheduledDate: new Date("2026-04-07T15:00:00.000Z"),
        shortText: "古い通知",
        description: "説明B",
        actionSuggestion: "提案B",
        isRead: true,
        createdAt: new Date("2026-04-07T15:00:00.000Z"),
      },
    ]);

    await listNotifications(req, res);

    expect(res.json).toHaveBeenCalledWith([
      {
        id: "notif_new",
        rule_id: "rule_1",
        scheduled_date: new Date("2026-04-08T15:00:00.000Z"),
        short_text: "新しい通知",
        description: "説明A",
        action_suggestion: "提案A",
        is_read: false,
        created_at: new Date("2026-04-08T15:00:00.000Z"),
      },
      {
        id: "notif_old",
        rule_id: "rule_2",
        scheduled_date: new Date("2026-04-07T15:00:00.000Z"),
        short_text: "古い通知",
        description: "説明B",
        action_suggestion: "提案B",
        is_read: true,
        created_at: new Date("2026-04-07T15:00:00.000Z"),
      },
    ]);
  });

  test("is_read=false が指定されたら未読のみ取得する", async () => {
    const req = {
      query: {
        is_read: "false",
      },
    };
    const res = createMockRes();

    mockNotificationFindMany.mockResolvedValue([]);

    await listNotifications(req, res);

    expect(mockNotificationFindMany).toHaveBeenCalledWith({
      where: {
        isRead: false,
      },
      orderBy: {
        createdAt: "desc",
      },
      skip: 0,
      take: 20,
    });
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith([]);
  });

  test("page と page_size でページングできる", async () => {
    const req = {
      query: {
        page: "2",
        page_size: "3",
      },
    };
    const res = createMockRes();

    mockNotificationFindMany.mockResolvedValue([]);

    await listNotifications(req, res);

    expect(mockNotificationFindMany).toHaveBeenCalledWith({
      orderBy: {
        createdAt: "desc",
      },
      skip: 3,
      take: 3,
    });
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith([]);
  });

  test("page が不正な値なら 400 を返す", async () => {
    const req = {
      query: {
        page: "0",
      },
    };
    const res = createMockRes();

    await listNotifications(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid input" });
    expect(mockNotificationFindMany).not.toHaveBeenCalled();
  });

  test("一覧取得中に例外が起きたら 500 を返す", async () => {
    const req = {
      query: {},
    };
    const res = createMockRes();

    mockNotificationFindMany.mockRejectedValue(new Error("db error"));

    await listNotifications(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
  });
});

describe("markNotificationAsRead（通知既読API）", () => {
  beforeEach(() => {
    // 前のテスト結果が残ると判定がズレるので毎回リセットします。
    jest.clearAllMocks();
  });

  test("id が空なら 400 を返す", async () => {
    const req = {
      params: {
        id: "   ",
      },
    };
    const res = createMockRes();

    await markNotificationAsRead(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid input" });
    expect(mockNotificationFindUnique).not.toHaveBeenCalled();
    expect(mockNotificationUpdate).not.toHaveBeenCalled();
  });

  test("対象通知が存在しなければ 404 を返す", async () => {
    const req = {
      params: {
        id: "notif_missing",
      },
    };
    const res = createMockRes();

    mockNotificationFindUnique.mockResolvedValue(null);

    await markNotificationAsRead(req, res);

    expect(mockNotificationFindUnique).toHaveBeenCalledWith({
      where: {
        id: "notif_missing",
      },
    });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Not found" });
    expect(mockNotificationUpdate).not.toHaveBeenCalled();
  });

  test("存在する通知を既読にして snake_case で返す", async () => {
    const req = {
      params: {
        id: "notif_1",
      },
    };
    const res = createMockRes();

    mockNotificationFindUnique.mockResolvedValue({
      id: "notif_1",
    });
    mockNotificationUpdate.mockResolvedValue({
      id: "notif_1",
      ruleId: "rule_1",
      scheduledDate: new Date("2026-04-08T15:00:00.000Z"),
      shortText: "通知本文",
      description: "説明",
      actionSuggestion: "提案",
      isRead: true,
      createdAt: new Date("2026-04-08T15:00:00.000Z"),
    });

    await markNotificationAsRead(req, res);

    expect(mockNotificationUpdate).toHaveBeenCalledWith({
      where: {
        id: "notif_1",
      },
      data: {
        isRead: true,
      },
    });
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      id: "notif_1",
      rule_id: "rule_1",
      scheduled_date: new Date("2026-04-08T15:00:00.000Z"),
      short_text: "通知本文",
      description: "説明",
      action_suggestion: "提案",
      is_read: true,
      created_at: new Date("2026-04-08T15:00:00.000Z"),
    });
  });

  test("既読更新中に例外が起きたら 500 を返す", async () => {
    const req = {
      params: {
        id: "notif_1",
      },
    };
    const res = createMockRes();

    mockNotificationFindUnique.mockRejectedValue(new Error("db error"));

    await markNotificationAsRead(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
  });
});
