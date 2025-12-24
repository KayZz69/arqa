import { supabase } from "@/integrations/supabase/client";
import type { Position, ReportItem, PreviousDayData } from "./reportValidation";
import { calculateWriteOff } from "./reportValidation";

/**
 * Fetch all manager user IDs
 * @returns Array of manager user IDs
 */
async function getManagerIds(): Promise<string[]> {
    const { data: managers } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "manager");

    return managers?.map(m => m.user_id) || [];
}

/**
 * Send notifications to all managers
 * @param notifications - Array of notification objects
 */
async function sendNotifications(
    notifications: Array<{
        user_id: string;
        type: string;
        message: string;
        related_id: string | null;
    }>
): Promise<void> {
    if (notifications.length > 0) {
        await supabase.from("notifications").insert(notifications);
    }
}

/**
 * Check for low stock items and notify managers
 * Sends notifications for items below minimum stock threshold
 * 
 * @param items - Report items to check
 * @param positions - Position data with min_stock thresholds
 */
export async function checkLowStockAndNotify(
    items: ReportItem[],
    positions: Position[]
): Promise<void> {
    const managerIds = await getManagerIds();
    if (managerIds.length === 0) return;

    const lowStockPositions = items.filter(item => {
        const position = positions.find(p => p.id === item.position_id);
        return position && item.ending_stock < position.min_stock;
    });

    const notifications = lowStockPositions.flatMap(item => {
        const position = positions.find(p => p.id === item.position_id);
        if (!position) return [];

        return managerIds.map(userId => ({
            user_id: userId,
            type: "low_stock",
            message: `⚠️ ${position.name}: осталось ${item.ending_stock} ${position.unit}, рекомендуем заказать`,
            related_id: item.position_id,
        }));
    });

    await sendNotifications(notifications);
}

/**
 * Check for high write-off items and notify managers
 * Alerts when write-off exceeds 50% of available stock and is > 2 units
 * 
 * @param items - Report items to check
 * @param positions - Position data
 * @param previousDayData - Previous day ending stock and arrivals
 */
export async function checkHighWriteOffAndNotify(
    items: ReportItem[],
    positions: Position[],
    previousDayData: Record<string, PreviousDayData>
): Promise<void> {
    const managerIds = await getManagerIds();
    if (managerIds.length === 0) return;

    const notifications: Array<{
        user_id: string;
        type: string;
        message: string;
        related_id: string | null;
    }> = [];

    for (const item of items) {
        const prev = previousDayData[item.position_id];
        if (!prev) continue;

        const writeOff = calculateWriteOff(prev, item.ending_stock);
        const expectedUsage = prev.ending_stock + prev.arrivals;

        // Alert if write-off is more than 50% of available stock and > 2 units
        if (writeOff > expectedUsage * 0.5 && writeOff > 2) {
            const position = positions.find(p => p.id === item.position_id);
            if (!position) continue;

            for (const userId of managerIds) {
                notifications.push({
                    user_id: userId,
                    type: "high_writeoff",
                    message: `🚨 ${position.name}: списано ${writeOff} ${position.unit} (было ${prev.ending_stock}+${prev.arrivals})`,
                    related_id: item.position_id,
                });
            }
        }
    }

    await sendNotifications(notifications);
}

/**
 * Send report submission notification to managers
 * 
 * @param reportId - ID of the submitted report
 * @param userEmail - Email of the submitting user
 * @param formattedDate - Human-readable date string
 */
export async function notifyReportSubmitted(
    reportId: string,
    userEmail: string,
    formattedDate: string
): Promise<void> {
    const managerIds = await getManagerIds();
    if (managerIds.length === 0) return;

    const notifications = managerIds.map(userId => ({
        user_id: userId,
        type: "report_submitted",
        message: `Новый ежедневный отчёт от ${userEmail} за ${formattedDate}`,
        related_id: reportId,
    }));

    await sendNotifications(notifications);
}
