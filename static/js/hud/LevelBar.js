var constants = require('../GameConsts'),
	iconLevel = '⚔';

function LevelBar() {
	this.element = new createjs.Container();
	this.element.x = constants.GAME_WIDTH - 100;
	this.element.y = constants.GAME_HEIGHT - 60;

	this.icon = iconLevel;

	this.text = new createjs.Text(iconLevel + " ", "25px Komika", '#fff');
	this.text.x = 0;
	this.text.y = 0;
	this.element.addChild(this.text);

	this.level = 1;
}

LevelBar.prototype.registerEvents = function(emitter) {
	emitter.on('change-level', this.onChangeLevel.bind(this));
};

LevelBar.prototype.onChangeLevel = function(level) {
	console.log(level);
	this.text.text = iconLevel + " " + level.levelId;
};

module.exports = LevelBar;