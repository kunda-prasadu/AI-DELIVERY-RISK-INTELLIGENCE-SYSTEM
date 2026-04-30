'use strict';

const { v4: uuidv4 } = require('uuid');
const store = require('./notification.store');

const supportedChannels = ['email', 'slack', 'teams'];

function dispatch(payload) {
  const now = new Date().toISOString();
  const record = {
    id: uuidv4(),
    projectId: payload.projectId,
    channel: payload.channel,
    recipient: payload.recipient,
    message: payload.message,
    metadata: payload.metadata || {},
    status: 'SENT',
    sentAt: now,
  };

  return store.add(record);
}

function broadcast(payload) {
  const channels = payload.channels.filter((ch) => supportedChannels.includes(ch));
  return channels.map((channel) => dispatch({ ...payload, channel }));
}

module.exports = {
  dispatch,
  broadcast,
  supportedChannels,
};
