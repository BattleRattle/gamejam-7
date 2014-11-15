function SoundListener() {
	this.funSound = createjs.Sound.play('fun');
	this.funSound.stop();
}

SoundListener.prototype.registerEvent = function(emitter) {
	this.emitter = emitter;

	emitter.on('hit', this.onHit.bind(this));
	emitter.on('fun', this.onFun.bind(this));
};

SoundListener.prototype.onHit = function(event) {
	if (event.hitTarget == 'player') {
		createjs.Sound.play('girl-hurt');
	} else if (event.hitTarget == 'monster') {
		createjs.Sound.play('monster-hurt');
	}
};

SoundListener.prototype.onFun = function(event) {
	if (event.status) {
		this.funSound.play();
	} else {
		this.funSound.stop();
	}
};

module.exports = SoundListener;