var funSound = null;

function SoundListener() {
	if (!funSound) {
		funSound = createjs.Sound.play('fun');
	}
	funSound.stop();
}

SoundListener.prototype.registerEvent = function(emitter) {
	this.emitter = emitter;

	emitter.on('hit', this.onHit.bind(this));
	emitter.on('fun', this.onFun.bind(this));
	emitter.on('change-level', this.onChangeLevel.bind(this));
};

SoundListener.prototype.onHit = function(event) {
	if (event.hitTarget == 'player') {
		createjs.Sound.play('girl-hurt');
	} else if (event.hitTarget == 'monster') {
		createjs.Sound.play('monster-hurt');
	}
};

SoundListener.prototype.onChangeLevel = function(event) {
	funSound.stop();
};

SoundListener.prototype.onFun= function(event) {
	if (event.status) {
		funSound.play();
	} else {
		funSound.stop();
	}
};

module.exports = SoundListener;