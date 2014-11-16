function ComboListener() {
    this.level = 0;
	this.lastHit = 0;
	this.comboInterval = 0;
}

ComboListener.prototype.registerEvents = function(emitter) {
	this.emitter = emitter;
    emitter.on('hit', this.onHit.bind(this));
	emitter.on('change-level', this.onChangeLevel.bind(this));
};

ComboListener.prototype.onHit = function(event) {
    if (event.hitTarget == 'player') {
        return;
    }

	if (event.timeStamp - this.lastHit > this.comboInterval) {
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

ComboListener.prototype.onChangeLevel = function(level) {
	this.comboInterval = level.comboInterval;
};

module.exports = ComboListener;
