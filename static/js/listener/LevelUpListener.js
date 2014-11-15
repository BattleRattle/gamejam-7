
var LevelBuilder = require('../level/LevelBuilder');

var currentLevelId = 0;

function LevelUpListener() {
	this.levelBuidler = new LevelBuilder();
}

LevelUpListener.prototype.registerEvents = function(emitter) {
	this.emitter = emitter;

	emitter.on('monster-dead', this.onLevelUp.bind(this));
	emitter.on('start', this.onLevelUp.bind(this));
};

LevelUpListener.prototype.onLevelUp = function() {
	currentLevelId++;

	var newLevel = this.levelBuidler.getLevel(currentLevelId);

	this.emitter.emit('change-level', newLevel);
	console.log('levelup', newLevel);
};

module.exports = LevelUpListener;