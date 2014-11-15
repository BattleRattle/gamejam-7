
var LevelBuilder = require('../level/LevelBuilder');

var currentLevelId = 0;

function LevelUpListener() {
	this.levelBuidler = new LevelBuilder();
}

LevelUpListener.prototype.registerEvents = function(emitter) {
	this.emitter = emitter;

	//emitter.on('monster-dead', this.onLevelUp.bind(this));
	emitter.on('start-level', this.onStartLevel.bind(this));
};

LevelUpListener.prototype.onStartLevel = function(reachedNewLevel) {
	if (reachedNewLevel) {
		currentLevelId++;
	}

	var newLevel = this.levelBuidler.getLevel(currentLevelId);

	//console.log('levelup', newLevel);

	this.emitter.emit('change-level', newLevel);
};

module.exports = LevelUpListener;