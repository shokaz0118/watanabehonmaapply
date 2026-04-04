import { beforeEach, describe, expect, jest, test } from "@jest/globals";

// ここから下は、外部ライブラリやDBをテスト用のにせものにする準備です。
// 目的は「本物のDBや暗号処理を使わず、APIの分岐だけを確実にテストする」ことです。

const mockUserCreate = jest.fn<() => Promise<any>>();
const mockUserFindUnique = jest.fn<() => Promise<any>>();
const mockHash = jest.fn<() => Promise<string>>();
const mockCompare = jest.fn<() => Promise<boolean>>();
const mockSign = jest.fn<() => string>();

// PrismaClient の user.create / user.findUnique を差し替えます。
jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn(() => ({
    user: {
      create: mockUserCreate,
      findUnique: mockUserFindUnique,
    },
  })),
}));

// bcrypt は default export を使っているので、default オブジェクトを返します。
jest.mock("bcrypt", () => ({
  __esModule: true,
  default: {
    hash: mockHash,
    compare: mockCompare,
  },
}));

// jsonwebtoken も default export 経由で sign を使うので同様に差し替えます。
jest.mock("jsonwebtoken", () => ({
  __esModule: true,
  default: {
    sign: mockSign,
  },
}));

// 互換エントリから読み込むことで、実運用と同じ入口をテストできます。
const { register, login } = require("../src/auth");

function createMockRes() {
  // Express の res をまねる最小セット。
  // status(...).json(...) のチェーンが動くようにしています。
  const res: any = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

describe("register（認証API）", () => {
  beforeEach(() => {
    // テストごとに呼び出し回数をリセットしないと、前の結果が混ざります。
    jest.clearAllMocks();
  });

  test("email または password が欠けていたら 400 を返す", async () => {
    const req = { body: { email: "test@example.com" } };
    const res = createMockRes();

    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Missing" });
    expect(mockHash).not.toHaveBeenCalled();
    expect(mockUserCreate).not.toHaveBeenCalled();
  });

  test("入力が正しければパスワードをハッシュ化して保存し、id と email を返す", async () => {
    const req = {
      body: {
        email: "test@example.com",
        password: "pass1234",
      },
    };
    const res = createMockRes();

    mockHash.mockResolvedValue("hashed-pass");
    mockUserCreate.mockResolvedValue({
      id: 1,
      email: "test@example.com",
      password: "hashed-pass",
      createdAt: new Date("2026-04-04T00:00:00.000Z"),
    });

    await register(req, res);

    expect(mockHash).toHaveBeenCalledWith("pass1234", 10);
    expect(mockUserCreate).toHaveBeenCalledWith({
      data: {
        email: "test@example.com",
        password: "hashed-pass",
      },
    });
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ id: 1, email: "test@example.com" });
  });

  test("DB保存などで例外が起きたら 500 を返す", async () => {
    const req = {
      body: {
        email: "test@example.com",
        password: "pass1234",
      },
    };
    const res = createMockRes();

    mockHash.mockResolvedValue("hashed-pass");
    mockUserCreate.mockRejectedValue(new Error("db error"));

    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
  });
});

describe("login（認証API）", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("email または password が欠けていたら 401 を返す", async () => {
    const req = { body: { email: "test@example.com" } };
    const res = createMockRes();

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid" });
    expect(mockUserFindUnique).not.toHaveBeenCalled();
  });

  test("メールに対応するユーザーがいなければ 401 を返す", async () => {
    const req = {
      body: {
        email: "none@example.com",
        password: "pass1234",
      },
    };
    const res = createMockRes();

    mockUserFindUnique.mockResolvedValue(null);

    await login(req, res);

    expect(mockUserFindUnique).toHaveBeenCalledWith({
      where: {
        email: "none@example.com",
      },
    });
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid" });
    expect(mockCompare).not.toHaveBeenCalled();
  });

  test("パスワードが一致しなければ 401 を返す", async () => {
    const req = {
      body: {
        email: "test@example.com",
        password: "wrong-pass",
      },
    };
    const res = createMockRes();

    mockUserFindUnique.mockResolvedValue({
      id: 1,
      email: "test@example.com",
      password: "hashed-pass",
      createdAt: new Date("2026-04-04T00:00:00.000Z"),
    });
    mockCompare.mockResolvedValue(false);

    await login(req, res);

    expect(mockCompare).toHaveBeenCalledWith("wrong-pass", "hashed-pass");
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid" });
    expect(mockSign).not.toHaveBeenCalled();
  });

  test("認証に成功したら token を返す", async () => {
    const req = {
      body: {
        email: "test@example.com",
        password: "pass1234",
      },
    };
    const res = createMockRes();

    mockUserFindUnique.mockResolvedValue({
      id: 42,
      email: "test@example.com",
      password: "hashed-pass",
      createdAt: new Date("2026-04-04T00:00:00.000Z"),
    });
    mockCompare.mockResolvedValue(true);
    mockSign.mockReturnValue("jwt-token");

    await login(req, res);

    expect(mockSign).toHaveBeenCalledWith({ userId: 42 }, expect.any(String), { expiresIn: "7d" });
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ token: "jwt-token" });
  });

  test("ユーザー検索などで例外が起きたら 500 を返す", async () => {
    const req = {
      body: {
        email: "test@example.com",
        password: "pass1234",
      },
    };
    const res = createMockRes();

    mockUserFindUnique.mockRejectedValue(new Error("db error"));

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
  });
});
