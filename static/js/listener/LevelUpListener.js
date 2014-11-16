
var LevelBuilder = require('../level/LevelBuilder');

var currentLevelId = 0;

function LevelUpListener() {
	this.levelBuidler = new LevelBuilder();
}

LevelUpListener.prototype.registerEvents = function(emitter) {
	this.emitter = emitter;

	//emitter.on('monster-dead', this.onLevelUp.bind(this));
	emitter.on('start-level', this.onStartLevel.bind(this));
	emitter.on('game-over', this.onGameOver.bind(this));
};

LevelUpListener.prototype.onStartLevel = function() {
	currentLevelId++;

	var newLevel = this.levelBuidler.getLevel(currentLevelId);

	this.emitter.emit('change-level', newLevel);
};

LevelUpListener.prototype.onGameOver = function() {
	currentLevelId = 1;

	var newLevel = this.levelBuidler.getLevel(currentLevelId);

	this.emitter.emit('change-level', newLevel);
};

module.exports = LevelUpListener;