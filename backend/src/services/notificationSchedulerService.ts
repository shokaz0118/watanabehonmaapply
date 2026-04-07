import { listRuleRecords, type RuleRecord } from "../repositories/ruleRepository";
import { existsNotificationForRuleInRange } from "../repositories/notificationRepository";
import { generateNotificationService } from "./notificationService";

let schedulerTimer: NodeJS.Timeout | null = null;

function parseTime(value: string): { hour: number; minute: number } | null {
  const parts = value.split(":");
  if (parts.length !== 2) {
    return null;
  }

  const hour = Number.parseInt(parts[0], 10);
  const minute = Number.parseInt(parts[1], 10);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    return null;
  }
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  return { hour, minute };
}

function isRuleDueNow(rule: RuleRecord, now: Date): boolean {
  if (!rule.isEnabled) {
    return false;
  }

  const parsed = parseTime(rule.time);
  if (!parsed) {
    return false;
  }
  if (parsed.hour !== now.getHours() || parsed.minute !== now.getMinutes()) {
    return false;
  }

  const day = now.getDay();
  if (rule.frequency === "daily") {
    return true;
  }
  if (rule.frequency === "weekdays") {
    return day >= 1 && day <= 5;
  }
  if (rule.frequency === "weekly") {
    // 週次は「そのルールを作成した曜日」に配信します。
    return day === rule.createdAt.getDay();
  }

  return false;
}

function getMinuteWindow(now: Date): { from: Date; to: Date } {
  const from = new Date(now);
  from.setSeconds(0, 0);

  const to = new Date(from);
  to.setMinutes(to.getMinutes() + 1);

  return { from, to };
}

export async function runNotificationSchedulerOnce(now: Date = new Date()): Promise<void> {
  const rules = await listRuleRecords(undefined);
  const dueRules = rules.filter((rule) => isRuleDueNow(rule, now));
  if (dueRules.length === 0) {
    return;
  }

  const { from, to } = getMinuteWindow(now);
  for (const rule of dueRules) {
    const exists = await existsNotificationForRuleInRange(rule.id, from, to);
    if (exists) {
      continue;
    }

    const generated = await generateNotificationService({ rule_id: rule.id });
    if (!generated.ok) {
      console.error(
        `[scheduler] failed to generate notification for rule ${rule.id}: ${generated.error}`,
      );
    }
  }
}

export function startNotificationScheduler(intervalMs: number = 60_000): void {
  if (schedulerTimer) {
    return;
  }

  schedulerTimer = setInterval(() => {
    void runNotificationSchedulerOnce().catch((error) => {
      console.error("[scheduler] unexpected error", error);
    });
  }, intervalMs);

  void runNotificationSchedulerOnce().catch((error) => {
    console.error("[scheduler] initial run error", error);
  });
}

export function stopNotificationScheduler(): void {
  if (!schedulerTimer) {
    return;
  }

  clearInterval(schedulerTimer);
  schedulerTimer = null;
}
