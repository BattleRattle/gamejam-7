var GameOverScreen = function() {
	this.element = new createjs.Container();
};

GameOverScreen.prototype.start = function() {
	this.element.addChild(new createjs.Bitmap('./img/gameover.png'));

	this.element.scaleX = 0.54;
	this.element.scaleY = 0.72;
};

GameOverScreen.prototype.reset = function() {
	this.element.removeAllChildren();
};

module.exports = GameOverScreen;
