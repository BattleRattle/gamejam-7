var constants = require('../GameConsts');

function LevelBar() {
	this.element = new createjs.Container();
	this.element.x = constants.GAME_WIDTH - 130;
	this.element.y = constants.GAME_HEIGHT - 60;

	this.text = new createjs.Text(" ", "25px Komika", '#fff');
	this.text.x = 0;
	this.text.y = 0;
	this.element.addChild(this.text);
}

LevelBar.prototype.registerEvents = function(emitter) {
	emitter.on('change-level', this.onChangeLevel.bind(this));
};

LevelBar.prototype.onChangeLevel = function(level) {
	this.text.text = "Level " + level.levelId;
};

module.exports = LevelBar;