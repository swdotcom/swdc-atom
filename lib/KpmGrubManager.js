"use babel";

import AppConstants from "./AppConstants";
const utilMgr = require("./UtilManager");

// commmented out for now until we tie in toggling the command palette

// taco time map
let tacoTimeMap = {
  count: 0,
  activated: false
};

// 11am
const lunchHour = 11;
// 5pm.
const dinnerHour = 17;
// past 30 minutes after the hour
const minutesOfHour = 0;
// max number of tacos displayed.
const maxTacos = 15;

let grubWindow = null;
let appConstants = null;

export default class KpmGrubManager {
  constructor(grubModalPanel) {
    if (!appConstants) {
      appConstants = new AppConstants();
    }
  }

  // Returns an object that can be retrieved
  // when package is activated
  serialize() {
    //
  }

  // Tear down any state and detach
  destroy() {
    element.remove();
  }

  showTacoTime() {
    if (tacoTimeMap.count > 0) {
      return;
    }

    this.orderGrubCommand();

    this.renderTacoTimeMessage(1);
  }

  renderTacoTimeMessage(count) {
    count = count === undefined || count === null ? 1 : count;

    let tacos = "";
    for (let i = 0; i < count; i++) {
      tacos += "🌮 ";
    }

    let d = new Date();
    let hourOfDay = d.getHours();

    let tacoMsg = "Software " + tacos;

    this.showTacoTimeStatus(tacoMsg, "Is It Taco Time?");
    if (count === 3) {
      count = 1;
    } else {
      count++;
    }

    if (hourOfDay === lunchHour) {
      if (tacoTimeMap.count >= maxTacos) {
        this.showTacoTimeStatus("Software 🌮", "Is it taco time?");
        return;
      }
      tacoTimeMap.count += 1;
    } else {
      if (tacoTimeMap.count >= maxTacos) {
        this.showTacoTimeStatus("Software 🌮", "Is it taco time?");
        return;
      }
      tacoTimeMap.count += 1;
    }

    setTimeout(() => {
      this.renderTacoTimeMessage(count);
    }, 2000);
  }

  async showTacoTimeStatus(msg, tooltip) {
    utilMgr
      .getStatusView()
      .display(msg, await appConstants.getLaunchUrl(), "", tooltip);
  }

  orderGrubCommand() {
    //
  }

  isTacoTime() {
    let d = new Date();

    let hour = d.getHours();
    let minutes = d.getMinutes();
    // 0 = sun, 6 = sat
    let day = d.getDay();

    let isWeekday = day >= 0 && day <= 5 ? true : false;
    let isLunchOrDinner =
      hour === lunchHour || hour === dinnerHour ? true : false;
    let isPastMinutesThreshold = minutes >= minutesOfHour ? true : false;

    // as long as it's a weekday and the hour is 11 or 5 and
    // it's past 30 minutes after the hour it's taco time
    if (isWeekday && isLunchOrDinner && isPastMinutesThreshold) {
      return true;
    } else {
      // clear the map altogether
      this.resetTacoTimeMap();
    }
    return false;
  }

  resetTacoTimeMap() {
    tacoTimeMap = {
      count: 0,
      activated: false
    };
  }
}
