var Growl = require('./Growl'),
    CollisionListener = require('../listener/CollisionListener');

var growlLifeTime = 3000;

function GrowlHandler() {
    this.element = new createjs.Container();
    this.growls = [];

    this.shouldSpan = false;
    this.listeners = [];
}

GrowlHandler.prototype.setTarget = function(target) {
    this.target = target;
};

GrowlHandler.prototype.registerEvents = function(emitter) {
    this.emitter = emitter;
};

GrowlHandler.prototype.reset = function() {
    this.growls = [];
    this.listeners = [];
    this.element.removeAllChildren();
};

GrowlHandler.prototype.span = function(event) {
    this.shouldSpan = true;
    this.nextSpan = event;
};

GrowlHandler.prototype.tick = function(event) {
    if (this.shouldSpan) {
        var growl = new Growl(this.nextSpan.x, this.nextSpan.y, this.nextSpan.rotation, event.timeStamp + growlLifeTime);
        this.element.addChild(growl.element);
        this.shouldSpan = false;
        this.growls.push(growl);
        var listener = new CollisionListener(this.target, growl);
        listener.registerEvents(this.emitter);
        this.listeners.push(listener);
    }

    for (var i = this.growls.length - 1; i >= 0; i--) {
        if (this.growls[i].lifetime < event.timeStamp) {
            this.element.removeChild(this.growls[i].element);
            this.growls.splice(i, 1);
            this.listeners.splice(i, 1);
            continue;
        }

        if (typeof this.growls[i]['tick'] == 'function') {
            this.growls[i].tick(event);
        }
    }

    for (var i = 0; i < this.listeners.length; i++) {
        this.listeners[i].tick(event);
    }
};

module.exports = GrowlHandler;
