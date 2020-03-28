'use babel';

const moment = require('moment-timezone');

const dayFormat = 'YYYY-MM-DD';
const dayTimeFormat = 'LLLL';

const timeUtil = {};

/**
 * Return the local and utc unix and day values
 */
timeUtil.getNowTimes = () => {
    const now_in_sec = moment().unix();
    const local = moment().local();
    const offset_in_sec = moment.parseZone(local).utcOffset() * 60;
    const local_now_in_sec = now_in_sec + offset_in_sec;
    const day = moment()
        .utcOffset(moment.parseZone(local).utcOffset())
        .format(dayFormat);
    const utcDay = moment()
        .utcOffset(0)
        .format(dayTimeFormat);
    const localDayTime = moment()
        .utcOffset(moment.parseZone(local).utcOffset())
        .format(dayTimeFormat);

    return {
        now_in_sec,
        local_now_in_sec,
        day,
        utcDay,
        localDayTime,
    };
};

module.exports = timeUtil;
