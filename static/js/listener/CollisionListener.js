function CollisionListener(a, b) {
    this.a = a;
    this.b = b;
}

CollisionListener.prototype.registerEvents = function(emitter) {
    this.emitter = emitter;
};

CollisionListener.prototype.tick = function(event) {
    var dist = Math.sqrt(Math.pow(this.b.element.x - this.a.element.x, 2) + Math.pow(this.b.element.y - this.a.element.y, 2));
    var addedRadius = this.a.getRadius() + this.b.getRadius();
    if (dist < addedRadius) {
        var attack = false;
        if (this.a.isShortAttacking() && this.b.id !== 'growl') {
            this.emitter.emit('hit', {
                timeStamp: event.timeStamp,
                hitTarget: this.b.id,
                damage: 10,
                damageDealer: this.a.id
            });

            attack = true;
        }

        if (this.b.isShortAttacking() && this.a.id !== 'growl') {
            this.emitter.emit('hit', {
                timeStamp: event.timeStamp,
                hitTarget: this.a.id,
                damage: 10,
                damageDealer: this.b.id
            });

            attack = true;
        }

        var damageDealer = this.a.id == 'player' ? this.b.id : this.a.id;
        if (!attack) {
            this.emitter.emit('hit', {
                timeStamp: event.timeStamp,
                hitTarget: 'player',
                damage: 10,
                damageDealer: damageDealer
            });
        } else {
            if (this.a.id == 'growl') {
                this.a.hit();
            } else if (this.b.id == 'growl') {
                this.b.hit();
            }
        }
    }
};

module.exports = CollisionListener;
