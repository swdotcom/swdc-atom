'use babel'

const utilMgr = require('./UtilManager')
const fs = require('fs')

/**
 * Handles the offline calculation update.
 **/
let offlineMgr = {}

let sessionSummaryData = {
    currentDayMinutes: 0,
    averageDailyMinutes: 0,
    averageDailyKeystrokes: 0,
    currentDayKeystrokes: 0,
    liveshareMinutes: 0,
}

offlineMgr.clearSessionSummaryData = () => {
    sessionSummaryData = {
        currentDayMinutes: 0,
        averageDailyMinutes: 0,
        averageDailyKeystrokes: 0,
        currentDayKeystrokes: 0,
        liveshareMinutes: 0,
    }

    offlineMgr.saveSessionSummaryToDisk(offlineMgr.getSessionSummaryData())
}

offlineMgr.setSessionSummaryLiveshareMinutes = minutes => {
    sessionSummaryData.liveshareMinutes = minutes
}

offlineMgr.incrementSessionSummaryData = (minutes, keystrokes) => {
    sessionSummaryData.currentDayMinutes += minutes
    sessionSummaryData.currentDayKeystrokes += keystrokes
}

offlineMgr.updateStatusBarWithSummaryData = () => {
    // update the session summary data with what is found in the sessionSummary.json

    sessionSummaryData = offlineMgr.getSessionSummaryFileAsJson()

    if (utilMgr.isCodeTime()) {
        let currentDayMinutes = sessionSummaryData.currentDayMinutes
        let currentDayMinutesTime = utilMgr.humanizeMinutes(currentDayMinutes)
        let averageDailyMinutes = sessionSummaryData.averageDailyMinutes
        let averageDailyMinutesTime = utilMgr.humanizeMinutes(
            averageDailyMinutes
        )

        let inFlowIcon = currentDayMinutes > averageDailyMinutes ? '🚀 ' : ''
        let msg = `${inFlowIcon}${currentDayMinutesTime}`
        if (averageDailyMinutes > 0) {
            msg += ` | ${averageDailyMinutesTime}`
        }
        utilMgr.showStatus(msg, null)
    } else {
        let msg = '🎧'

        utilMgr.showStatus(msg, null)
    }
}

offlineMgr.getSessionSummaryData = () => {
    return sessionSummaryData
}

offlineMgr.getSessionSummaryFile = () => {
    let file = utilMgr.getSoftwareDir()
    if (utilMgr.isWindows()) {
        file += '\\sessionSummary.json'
    } else {
        file += '/sessionSummary.json'
    }
    return file
}

offlineMgr.saveSessionSummaryToDisk = sessionSummaryData => {
    try {
        // JSON.stringify(data, replacer, number of spaces)
        const content = JSON.stringify(sessionSummaryData, null, 4)
        fs.writeFileSync(offlineMgr.getSessionSummaryFile(), content, err => {
            if (err)
                console.log(
                    `Deployer: Error writing session summary data: ${err.message}`
                )
        })
    } catch (e) {
        //
    }
}

offlineMgr.getSessionSummaryFileAsJson = () => {
    let data = null
    let file = offlineMgr.getSessionSummaryFile()
    if (fs.existsSync(file)) {
        const content = fs.readFileSync(file).toString()
        if (content) {
            try {
                data = JSON.parse(content)
            } catch (e) {
                console.log(`unable to read session info: ${e.message}`)
                // error trying to read the session file, delete it
                utilMgr.deleteFile(file)
                data = {}
            }
        }
    }
    return data ? data : {}
}

module.exports = offlineMgr
