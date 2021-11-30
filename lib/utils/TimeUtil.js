'use babel';


const timeUtil = {};

timeUtil.getNowTimes = () => {
  const d = new Date();
  const utcSeconds = Math.round(d.getTime() / 1000);
  const localSeconds = utcSeconds - (d.getTimezoneOffset() * 60);

  return {
    utcSeconds,
    localSeconds
  }
}

module.exports = timeUtil;
