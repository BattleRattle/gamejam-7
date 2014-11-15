
function LevelUpListener() {
}

LevelUpListener.prototype.registerEvents = function(emitter) {
	this.emitter = emitter;

	emitter.on('monster-dead', this.onLevelUp.bind(this));
};

LevelUpListener.prototype.onLevelUp = function(event) {
	console.log(event);
};

module.exports = LevelUpListener;