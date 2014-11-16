'use strict';

var numPetals = 12;

var Flower = function(x, y, color) {
    this.element = new createjs.Container();
	this.element.x = x;
	this.element.y = y;
	this.element.scaleX = this.element.scaleY = 0.1;

	for(var n = 0; n < numPetals; n++) {
		var petal = new createjs.Shape();

		petal.graphics
			.beginFill('#ff0')
			.drawCircle(0, 0, 20)
			//.beginStroke('#fff')
			.setStrokeStyle(3)
			.beginFill(color)
			.moveTo(-5, -20)
			.bezierCurveTo(-40, -90, 40, -90, 5, -20)
			.closePath();
		petal.rotation = 360 * n / numPetals;

		this.element.addChild(petal);
	}

	//this.element.cache(-100, -100, 200, 200);
};

module.exports = Flower;