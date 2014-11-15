var Ground = function() {
	var self = this;

	this.element = new createjs.Container();

	this.shape = new createjs.Shape();

	var img = new Image();
	img.onload = function() {
		self.shape.graphics.beginBitmapFill(img, 'repeat').drawRect(0, 0, 10000, 10000).endFill();
	};
	img.src = './img/grass.png';

	this.element.addChild(this.shape);
	this.element.x = -5000;
	this.element.y = -5000;
};

module.exports = Ground;
