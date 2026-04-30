'use strict';

class NotificationStore {
  constructor() {
    this.records = [];
  }

  add(record) {
    this.records.push(record);
    return record;
  }

  list(filters = {}) {
    const { projectId, channel } = filters;
    return this.records.filter((r) => {
      if (projectId && r.projectId !== projectId) return false;
      if (channel && r.channel !== channel) return false;
      return true;
    });
  }

  clear() {
    this.records = [];
  }
}

module.exports = new NotificationStore();
