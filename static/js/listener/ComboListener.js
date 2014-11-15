var comboInterval = 1500;

function ComboListener() {
    this.level = -1;
    this.comboEnd = 0;
}

ComboListener.prototype.registerEvents = function(emitter) {
    emitter.on('hit', this.onHit.bind(this));
    this.emitter = emitter;
};

ComboListener.prototype.onHit = function(event) {
    if (event.hitTarget == 'player') {
        return;
    }

    if (this.comboEnd > event.timeStamp) {
        this.increaseCombo(event.timeStamp);
    } else {
        this.reset(event.timeStamp);
    }
};

ComboListener.prototype.tick = function(event) {
    if (this.level <= 0) {
        return;
    }

    if (this.comboEnd < event.timeStamp) {
        this.emitter.emit('combo', {
            level: this.level
        });

        this.level = -1;
    }
};

ComboListener.prototype.reset = function(timeStamp) {
    this.level = 0;
    this.comboEnd = timeStamp + comboInterval;
};

ComboListener.prototype.increaseCombo = function(timeStamp) {
    this.level++;
    this.comboEnd = comboInterval + timeStamp;
};

module.exports = ComboListener;
