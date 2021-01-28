'use babel';

export default {

  pauseSlackNotifications: {
    title: 'Pause Slack Notifications',
    description: "Automatically pause Slack notifications when I'm in flow",
    type: 'boolean',
    default: true,
    order: 0
  },
  slackAwayStatus: {
    title: 'Slack Away Status',
    description: "Automatically set my status away when I'm in flow.",
    type: 'boolean',
    default: true,
    order: 1
  },
  slackAwayStatusText: {
    title: 'Slack Away Status Text',
    description: 'Customize your away status in Slack.',
    type: 'string',
    default: 'CodeTime!',
    order: 2
  },
  screenMode: {
    title: 'Screen Mode',
    description: "Automatically toggle a selected screen mode when I'm in flow.",
    type: 'string',
    default: 'Full Screen',
    order: 3,
    enum: [
      { value: 'Full Screen', description: 'Full Screen' },
      { value: 'None', description: 'None' }
    ]
  },
  flowModeReminders: {
    title: 'Flow Mode Reminders',
    description: "Remind me to enable Flow Mode when I'm in flow.",
    type: 'boolean',
    default: true,
    order: 4
  }
};
