'use babel';

const timeUtil = require('../utils/TimeUtil');

export default class TimeCounterStats {
    constructor() {
        const nowTimes = timeUtil.getNowTimes();
        this.last_unfocused_timestamp_utc = 0;
        this.elapsed_code_time_seconds = 0;
        this.elapsed_active_code_time_seconds = 0;
        this.elapsed_seconds = 0;
        this.focused_editor_seconds = 0;
        this.cumulative_code_time_seconds = 0;
        this.cumulative_active_code_time_seconds = 0;

        // set the last payload end and focused time to now (UTC)
        this.last_focused_timestamp_utc = nowTimes.now_in_sec;
        this.last_payload_end_utc = nowTimes.now_in_sec;
        this.current_day = nowTimes.day;
    }
}
