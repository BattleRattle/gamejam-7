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
    var addedRadius = this.a.getRadius() + this.b.getRadius();
    if (dist < addedRadius) {
        if (!this.touching) {
            var attack = false;
            if (this.a.isShortAttacking()) {
                this.emitter.emit('hit', {
                    timeStamp: event.timeStamp,
                    hitTarget: this.b.id,
                    damage: 10
                });

                attack = true;
            }

            if (this.b.isShortAttacking()) {
                this.emitter.emit('hit', {
                    timeStamp: event.timeStamp,
                    hitTarget: this.a.id,
                    damage: 10
                });

                attack = true;
            }

            if (!attack) {
                this.emitter.emit('hit', {
                    timeStamp: event.timeStamp,
                    hitTarget: 'player',
                    damage: 10
                });
            }
        }

        this.touching = true;
    } else {
        this.touching = false;
    }
};

module.exports = CollisionListener;
