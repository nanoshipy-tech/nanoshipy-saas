'use strict';

const EventEmitter = require('events');

class PlatformEventBus extends EventEmitter {
  constructor() {
    super();
    // Allow large listeners count since multiple callbacks hook common milestones
    this.setMaxListeners(50);
  }
}

const eventBus = new PlatformEventBus();
module.exports = eventBus;
