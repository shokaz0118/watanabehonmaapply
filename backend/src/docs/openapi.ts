// OpenAPI定義です。
// このオブジェクトを Swagger UI と Postman の両方で使います。
// - Swagger UI: ブラウザから「Try it out」でAPI実行
// - Postman: /api/openapi.json をインポートしてコレクション化
//
// このファイルの責任範囲:
// 1. APIの「説明書」を1か所にまとめる
// 2. どのURLに、どんな入力を送るかを定義する
// 3. どんなレスポンスが返るか（成功/失敗）を定義する
//
// このファイルでやらないこと:
// - 実際の処理（DB保存など）
// - バリデーション実行
// それらは Controller / Service / Repository 側で実行されます。
// ここは「仕様の地図」です。

const openApiDocument = {
  // OpenAPIのバージョン。Swagger UI が読むときに使います。
  openapi: "3.0.3",

  // 仕様書そのもののタイトルや説明。
  info: {
    title: "AI通知アプリ API",
    version: "1.0.0",
    description: "認証・通知ルール管理のAPI仕様",
  },

  // APIサーバーの接続先一覧。
  // ローカル開発では localhost:3001 を使います。
  servers: [
    {
      url: "http://localhost:3001",
      description: "Local",
    },
  ],

  // 画面上でAPIをグループ分けするラベルです。
  // Swagger UIの左側メニューでまとまり表示されます。
  tags: [
    { name: "Health", description: "稼働確認" },
    { name: "Auth", description: "認証" },
    { name: "Rules", description: "通知ルール" },
    { name: "Notifications", description: "通知生成" },
  ],

  // paths は「URLごとの定義」です。
  // ここに GET / POST / PATCH などを1つずつ書きます。
  paths: {
    "/api/health": {
      get: {
        // どのグループに表示するか
        tags: ["Health"],
        // 一行説明
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

        // requestBody は「リクエストの中身」の定義です。
        // required: true なのでbody必須です。
        requestBody: {
          required: true,
          content: {
            "application/json": {
              // $ref は「components/schemas の定義を再利用する」という意味です。
              // 同じ型を何度もコピペしなくて済みます。
              schema: {
                $ref: "#/components/schemas/RegisterRequest",
              },
            },
          },
        },
        responses: {
          // 200: 成功時
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
          // 400: 入力不足
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
          // 500: サーバー側の想定外エラー
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
          // 401: 認証失敗（ID/パスワード不一致など）
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
                  // 一覧なので type: array。
                  // items に1件分の型（RuleResponse）を指定します。
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
    "/api/rules/{id}": {
      patch: {
        tags: ["Rules"],
        summary: "通知ルール更新",

        // parameters はURLパスの変数です。
        // /api/rules/{id} の {id} 部分を定義します。
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: {
              type: "string",
            },
            description: "更新対象ルールID",
          },
        ],

        // 更新は部分更新なので、bodyは項目を必要な分だけ送ります。
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/UpdateRuleRequest",
              },
            },
          },
        },
        responses: {
          "200": {
            description: "更新成功",
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
          "404": {
            description: "対象なし",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/NotFoundError",
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
      delete: {
        tags: ["Rules"],
        summary: "通知ルール削除",

        // pathの id を受け取って削除対象を決めます。
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: {
              type: "string",
            },
            description: "削除対象ルールID",
          },
        ],

        responses: {
          "204": {
            description: "削除成功（本文なし）",
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
          "404": {
            description: "対象なし",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/NotFoundError",
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
    "/api/notifications/generate": {
      post: {
        tags: ["Notifications"],
        summary: "通知を1件手動生成",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/GenerateNotificationRequest",
              },
            },
          },
        },
        responses: {
          "200": {
            description: "生成成功",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/NotificationResponse",
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
          "404": {
            description: "対象ルールなし",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/NotFoundError",
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
    "/api/notifications": {
      get: {
        tags: ["Notifications"],
        summary: "通知履歴一覧取得",
        parameters: [
          {
            name: "is_read",
            in: "query",
            required: false,
            schema: {
              type: "string",
              enum: ["true", "false"],
            },
            description: "既読状態で絞り込み。未読のみは false を指定",
          },
          {
            name: "page",
            in: "query",
            required: false,
            schema: {
              type: "integer",
              minimum: 1,
              default: 1,
            },
            description: "ページ番号（1始まり）",
          },
          {
            name: "page_size",
            in: "query",
            required: false,
            schema: {
              type: "integer",
              minimum: 1,
              default: 20,
            },
            description: "1ページあたりの件数",
          },
        ],
        responses: {
          "200": {
            description: "取得成功",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    $ref: "#/components/schemas/NotificationResponse",
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
    },
    "/api/notifications/{id}/read": {
      patch: {
        tags: ["Notifications"],
        summary: "通知を既読にする",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: {
              type: "string",
            },
            description: "既読化する通知ID",
          },
        ],
        responses: {
          "200": {
            description: "既読化成功",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/NotificationResponse",
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
          "404": {
            description: "対象通知なし",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/NotFoundError",
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

  // components/schemas は「型の部品置き場」です。
  // paths側から $ref で参照して再利用します。
  components: {
    schemas: {
      // ===== Auth系 =====
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
      // ===== Rules系 =====
      CreateRuleRequest: {
        type: "object",
        properties: {
          theme: { type: "string", enum: ["名言", "雑学", "励まし"], example: "名言" },
          time: { type: "string", example: "15:00" },
          frequency: { type: "string", enum: ["daily", "weekdays", "weekly"], example: "daily" },
          is_enabled: { type: "boolean", example: true },
        },
        required: ["theme", "time", "frequency"],
      },
      UpdateRuleRequest: {
        type: "object",
        properties: {
          theme: { type: "string", enum: ["名言", "雑学", "励まし"], example: "雑学" },
          time: { type: "string", example: "16:30" },
          frequency: { type: "string", enum: ["daily", "weekdays", "weekly"], example: "weekdays" },
          is_enabled: { type: "boolean", example: false },
        },
        description: "更新したい項目だけを送る（最低1項目は必須）",
      },

      GenerateNotificationRequest: {
        type: "object",
        properties: {
          rule_id: { type: "string", example: "rule_1" },
        },
        required: ["rule_id"],
      },

      NotificationResponse: {
        type: "object",
        properties: {
          id: { type: "string", example: "notif_1" },
          rule_id: { type: "string", example: "rule_1" },
          scheduled_date: { type: "string", format: "date-time", example: "2026-04-08T15:00:00.000Z" },
          short_text: { type: "string", example: "継続は力なり。今日の一歩が未来を変える。" },
          description: { type: "string", example: "大きな成果は、毎日の小さな積み重ねから生まれます。" },
          action_suggestion: { type: "string", example: "今日は5分だけでも、やると決めたことを続けてみましょう。" },
          is_read: { type: "boolean", example: false },
          created_at: { type: "string", format: "date-time", example: "2026-04-08T15:00:00.000Z" },
        },
        required: [
          "id",
          "rule_id",
          "scheduled_date",
          "short_text",
          "description",
          "action_suggestion",
          "is_read",
          "created_at",
        ],
      },

      // RuleResponse は一覧取得・作成・更新で共通利用。
      // 返却時のキー名（snake_case）をここで固定します。
      RuleResponse: {
        type: "object",
        properties: {
          id: { type: "string", example: "rule_1" },
          theme: { type: "string", enum: ["名言", "雑学", "励まし"], example: "名言" },
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
      NotFoundError: {
        type: "object",
        properties: {
          error: { type: "string", example: "Not found" },
        },
        required: ["error"],
      },
    },
  },
} as const;

// index.tsx から import され、
// /api/openapi.json と /api/docs で使われます。
export default openApiDocument;
