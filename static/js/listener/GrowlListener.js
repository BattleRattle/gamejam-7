function GrowlListener(growlHandler) {
    this.growlHandler = growlHandler;
}

GrowlListener.prototype.registerEvents = function(emitter) {
    emitter.on('growl', this.onGrowl.bind(this));
};

GrowlListener.prototype.onGrowl = function(event) {
    this.growlHandler.span(event);
};

module.exports = GrowlListener;
