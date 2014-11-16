var GameConsts = require('./../GameConsts');

function StoryScreen() {
    this.element = new createjs.Container();
}

StoryScreen.prototype.start = function() {
	this.drawBubble(100, 200, 'Hello');
	this.drawBubble(GameConsts.GAME_WIDTH - 400, 300, 'Hi', true);
};

StoryScreen.prototype.reset = function() {
    this.element.removeAllChildren();
};

StoryScreen.prototype.drawBubble = function(x, y, text, isRight) {
	var w = 300;
	var h = 150;
	var r = x + w;
	var b = y + h;
	var radius = 10;

	var container = new createjs.Container();
	container.x = x;
	container.y = y;

	var bubble = new createjs.Shape();

	x= y = 0;

	bubble.graphics
		.beginFill('#fff')
		.beginStroke('#000')
		.setStrokeStyle(3)
		.moveTo(x + radius, y)
		.lineTo(x + radius / 2, y - 10)
		.lineTo(x + radius * 2, y)
		.lineTo(r - radius, y)
		.quadraticCurveTo(r, y, r, y + radius)
		.lineTo(r, y + h - radius)
		.quadraticCurveTo(r, b, r - radius, b)
		.lineTo(x + radius, b)
		.quadraticCurveTo(x, b, x, b - radius)
		.lineTo(x, y + radius)
		.quadraticCurveTo(x, y, x + radius, y)
		.closePath();

	bubble.scaleY = -1;
	bubble.y = h;

	if (isRight) {
		bubble.scaleX = -1;
		bubble.x = w;
	}

	container.addChild(bubble);

	var textElement = new createjs.Text(text, '25px Komika', '#000');
	textElement.x = 0;
	textElement.y = 0;
	container.addChild(textElement);

	this.element.addChild(container);
};

module.exports = StoryScreen;
