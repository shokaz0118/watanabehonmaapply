// OpenAPI定義です。
// このオブジェクトを Swagger UI と Postman の両方で使います。
// - Swagger UI: ブラウザから「Try it out」でAPI実行
// - Postman: /api/openapi.json をインポートしてコレクション化

const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "AI通知アプリ API",
    version: "1.0.0",
    description: "認証・通知ルール管理のAPI仕様",
  },
  servers: [
    {
      url: "http://localhost:3001",
      description: "Local",
    },
  ],
  tags: [
    { name: "Health", description: "稼働確認" },
    { name: "Auth", description: "認証" },
    { name: "Rules", description: "通知ルール" },
  ],
  paths: {
    "/api/health": {
      get: {
        tags: ["Health"],
        summary: "ヘルスチェック",
        responses: {
          "200": {
            description: "サーバー稼働中",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "ok" },
                  },
                  required: ["status"],
                },
              },
            },
          },
        },
      },
    },
    "/api/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "ユーザー登録",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/RegisterRequest",
              },
            },
          },
        },
        responses: {
          "200": {
            description: "登録成功",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/RegisterResponse",
                },
              },
            },
          },
          "400": {
            description: "入力不足",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/MissingError",
                },
              },
            },
          },
          "500": {
            description: "サーバーエラー",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/InternalError",
                },
              },
            },
          },
        },
      },
    },
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "ログイン",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/LoginRequest",
              },
            },
          },
        },
        responses: {
          "200": {
            description: "ログイン成功",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/LoginResponse",
                },
              },
            },
          },
          "401": {
            description: "認証失敗",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/InvalidError",
                },
              },
            },
          },
          "500": {
            description: "サーバーエラー",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/InternalError",
                },
              },
            },
          },
        },
      },
    },
    "/api/rules": {
      get: {
        tags: ["Rules"],
        summary: "通知ルール一覧取得",
        responses: {
          "200": {
            description: "取得成功",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    $ref: "#/components/schemas/RuleResponse",
                  },
                },
              },
            },
          },
          "500": {
            description: "サーバーエラー",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/InternalError",
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Rules"],
        summary: "通知ルール作成",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/CreateRuleRequest",
              },
            },
          },
        },
        responses: {
          "200": {
            description: "作成成功",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/RuleResponse",
                },
              },
            },
          },
          "400": {
            description: "入力不正",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/InvalidInputError",
                },
              },
            },
          },
          "500": {
            description: "サーバーエラー",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/InternalError",
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      RegisterRequest: {
        type: "object",
        properties: {
          email: { type: "string", example: "user@example.com" },
          password: { type: "string", example: "pass1234" },
        },
        required: ["email", "password"],
      },
      RegisterResponse: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          email: { type: "string", example: "user@example.com" },
        },
        required: ["id", "email"],
      },
      LoginRequest: {
        type: "object",
        properties: {
          email: { type: "string", example: "user@example.com" },
          password: { type: "string", example: "pass1234" },
        },
        required: ["email", "password"],
      },
      LoginResponse: {
        type: "object",
        properties: {
          token: { type: "string", example: "jwt-token" },
        },
        required: ["token"],
      },
      CreateRuleRequest: {
        type: "object",
        properties: {
          theme: { type: "string", example: "名言" },
          time: { type: "string", example: "15:00" },
          frequency: { type: "string", enum: ["daily", "weekdays", "weekly"], example: "daily" },
          is_enabled: { type: "boolean", example: true },
        },
        required: ["theme", "time", "frequency"],
      },
      RuleResponse: {
        type: "object",
        properties: {
          id: { type: "string", example: "rule_1" },
          theme: { type: "string", example: "名言" },
          time: { type: "string", example: "15:00" },
          frequency: { type: "string", example: "daily" },
          is_enabled: { type: "boolean", example: true },
          created_at: { type: "string", format: "date-time", example: "2026-04-04T15:00:00.000Z" },
          updated_at: { type: "string", format: "date-time", example: "2026-04-04T15:00:00.000Z" },
        },
        required: ["id", "theme", "time", "frequency", "is_enabled", "created_at", "updated_at"],
      },
      InvalidInputError: {
        type: "object",
        properties: {
          error: { type: "string", example: "Invalid input" },
        },
        required: ["error"],
      },
      MissingError: {
        type: "object",
        properties: {
          error: { type: "string", example: "Missing" },
        },
        required: ["error"],
      },
      InvalidError: {
        type: "object",
        properties: {
          error: { type: "string", example: "Invalid" },
        },
        required: ["error"],
      },
      InternalError: {
        type: "object",
        properties: {
          error: { type: "string", example: "Internal server error" },
        },
        required: ["error"],
      },
    },
  },
} as const;

export default openApiDocument;
