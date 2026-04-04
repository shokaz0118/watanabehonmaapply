// APIの入出力型を1か所に集めるファイルです。
// 画面側とAPIクライアント側で同じ型を使うことで、
// フィールド名のズレを減らせます。

export type AuthResponse = {
  id?: number;
  email?: string;
  token?: string;
};

export type Rule = {
  id: string;
  theme: string;
  time: string;
  frequency: "daily" | "weekdays" | "weekly";
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type NotificationItem = {
  id: string;
  rule_id: string;
  scheduled_date: string;
  short_text: string;
  description: string;
  action_suggestion: string;
  is_read: boolean;
  created_at: string;
};

export type ApiErrorResponse = {
  error?: string;
};

export type RuleCreateInput = {
  theme: string;
  time: string;
  frequency: "daily" | "weekdays" | "weekly";
  is_enabled: boolean;
};

export type RuleUpdateInput = Partial<RuleCreateInput>;

export type NotificationsQuery = {
  is_read?: "true" | "false";
  page?: number;
  page_size?: number;
};
