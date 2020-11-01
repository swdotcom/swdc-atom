'use babel';

export default class SessionSummary {
    constructor() {
        this.currentDayMinutes = 0;
        this.currentDayKeystrokes = 0;
        this.currentDayKpm = 0;
        this.currentDayLinesAdded = 0;
        this.currentDayLinesRemoved = 0;
        this.averageDailyMinutes = 0;
        this.averageDailyKeystrokes = 0;
        this.averageDailyKpm = 0;
        this.averageLinesAdded = 0;
        this.averageLinesRemoved = 0;
        this.globalAverageSeconds = 0;
        this.globalAverageDailyMinutes = 0;
        this.globalAverageDailyKeystrokes = 0;
        this.globalAverageLinesAdded = 0;
        this.globalAverageLinesRemoved = 0;
    }
}
