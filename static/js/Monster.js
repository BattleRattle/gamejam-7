var Monster = function(x, y) {
	this.radius = 30;

	this.element = new createjs.Container();

	var shape = new createjs.Shape();

	shape.graphics
		.beginFill("#F0F")
		.drawCircle(0, 0, 30);

	this.element.addChild(shape);

	this.element.x = x;
	this.element.y = y;
};

module.exports = Monster;
