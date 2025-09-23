export class DataFormatter {
    static formatDuration(duration: number): string {
        return duration.toFixed(2) + 's';
    }

    static formatPercentage(value: number): string {
        return value.toFixed(1) + '%';
    }

    static formatCount(count: number): string {
        return count.toString();
    }

    static calculatePerformanceImprovement(onpremiseDuration: number, cloudDuration: number): number {
        if (onpremiseDuration === 0 || cloudDuration === 0) return 0;
        
        const difference = Math.abs(onpremiseDuration - cloudDuration);
        const max = Math.max(onpremiseDuration, cloudDuration);
        return (difference / max) * 100;
    }

    static getStatusBadgeClass(status: number): string {
        const statusClass = Math.floor(status / 100) * 100;
        return `status-${statusClass}`;
    }

    static sanitizeForHTML(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
    }
}