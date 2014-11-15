var comboInterval = 1500;

function ComboListener() {
    this.level = 0;
	this.lastHit = 0;
}

ComboListener.prototype.registerEvents = function(emitter) {
    emitter.on('hit', this.onHit.bind(this));
    this.emitter = emitter;
};

ComboListener.prototype.onHit = function(event) {
    if (event.hitTarget == 'player') {
        return;
    }

	if (event.timeStamp - this.lastHit > comboInterval) {
		this.reset();
	}

	this.increaseCombo(event.timeStamp);
	this.lastHit = event.timeStamp;

	if (this.level > 1) {
		this.emitter.emit('combo', {
			level: this.level
		});
	}
};

ComboListener.prototype.tick = function(event) {

};

ComboListener.prototype.reset = function() {
    this.level = 0;
};

ComboListener.prototype.increaseCombo = function(timeStamp) {
    this.level++;
};

module.exports = ComboListener;
