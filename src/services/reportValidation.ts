import { z } from "zod";

/**
 * Schema for validating report item input
 */
export const reportItemSchema = z.object({
    ending_stock: z.coerce.number().min(0, "Должно быть 0 или больше"),
});

/**
 * Position type for daily reports
 */
export type Position = {
    id: string;
    name: string;
    category: string;
    unit: string;
    min_stock: number;
};

/**
 * Report item type
 */
export type ReportItem = {
    id?: string;
    position_id: string;
    ending_stock: number;
    write_off: number;
};

/**
 * Previous day data for write-off calculations
 */
export type PreviousDayData = {
    ending_stock: number;
    arrivals: number;
};

/**
 * Calculate write-off based on previous stock, arrivals, and current stock
 * @param previousData - Previous day ending stock and arrivals
 * @param endingStock - Current ending stock
 * @returns Write-off amount (never negative)
 */
export function calculateWriteOff(
    previousData: PreviousDayData | undefined,
    endingStock: number
): number {
    if (!previousData) return 0;
    // Write-off = Previous stock + Arrivals - Current stock
    return Math.max(0, previousData.ending_stock + previousData.arrivals - endingStock);
}

/**
 * Check if a category is fully filled
 * @param positions - Positions in the category
 * @param reportItems - Current report items
 * @returns True if all positions have ending_stock > 0
 */
export function isCategoryFilled(
    positions: Position[],
    reportItems: Record<string, ReportItem>
): boolean {
    return positions.every(pos => {
        const item = reportItems[pos.id];
        return item && item.ending_stock > 0;
    });
}

/**
 * Get report status based on report state
 * @param reportId - Report ID (null if draft)
 * @param isLocked - Whether report is locked
 * @returns Status string: "draft" or "submitted"
 */
export function getReportStatus(reportId: string | null, isLocked: boolean): "draft" | "submitted" {
    if (!reportId) return "draft";
    if (isLocked) return "submitted";
    return "draft";
}

/**
 * Calculate report summary statistics
 * @param reportItems - Current report items
 * @param previousDayData - Previous day data for all positions
 * @param visiblePositions - Visible positions list
 * @returns Summary with filled count, totals, and anomalies
 */
export function calculateReportSummary(
    reportItems: Record<string, ReportItem>,
    previousDayData: Record<string, PreviousDayData>,
    visiblePositions: Position[]
): {
    filledPositions: number;
    totalPositions: number;
    totalWriteOff: number;
    anomaliesCount: number;
} {
    const items = Object.values(reportItems);
    const filledPositions = items.filter(
        item => item.ending_stock > 0 && visiblePositions.some(p => p.id === item.position_id)
    ).length;

    const totalWriteOff = items.reduce((sum, item) => {
        const writeOff = calculateWriteOff(previousDayData[item.position_id], item.ending_stock);
        return sum + writeOff;
    }, 0);

    const anomaliesCount = items.filter(item => {
        const prev = previousDayData[item.position_id];
        if (!prev) return false;
        const writeOff = calculateWriteOff(prev, item.ending_stock);
        const expectedUsage = prev.ending_stock + prev.arrivals;
        return writeOff > expectedUsage * 0.5 && writeOff > 2;
    }).length;

    return {
        filledPositions,
        totalPositions: visiblePositions.length,
        totalWriteOff,
        anomaliesCount,
    };
}
