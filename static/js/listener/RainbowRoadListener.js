function RainbowRoadListener(rainbowRoad) {
    this.rainbowRoad = rainbowRoad;
}

RainbowRoadListener.prototype.registerEvents = function(emitter) {
    emitter.on('has-fun', this.onHasFun.bind(this));
};

RainbowRoadListener.prototype.onHasFun = function(event) {
    this.rainbowRoad.paint(event);
};

module.exports = RainbowRoadListener;
