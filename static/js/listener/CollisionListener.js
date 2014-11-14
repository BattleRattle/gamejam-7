function CollisionListener(a, b) {
    this.a = a;
    this.b = b;
}

CollisionListener.prototype.registerEvents = function(emitter) {
    this.emitter = emitter;
    this.touching = false
};

CollisionListener.prototype.tick = function(event) {
    var dist = Math.sqrt(Math.pow(this.b.element.x - this.a.element.x, 2) + Math.pow(this.b.element.y - this.a.element.y, 2));
    if (dist < this.a.radius + this.b.radius) {
        if (!this.touching) {
            this.emitter.emit('hit', {
                timeStamp: event.timeStamp,
                hitTarget: 'player'
            });

            this.touching = true;
        }
    } else {
        this.touching = false;
    }
};

module.exports = CollisionListener;
