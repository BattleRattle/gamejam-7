function RainbowRoad() {
    this.element = new createjs.Container();
	this.hasFan = 0;
}

RainbowRoad.prototype.paint = function(event) {
	for (var i = 0; i < 6; i++) {
		this.spawnJuicyStar(event.x, event.y);
	}
};

RainbowRoad.prototype.tick = function(event) {
    // remove old paintings
};

RainbowRoad.prototype.spawnJuicyStar = function(x, y) {
	var size = 8 + 7 * Math.random();

	var star = new createjs.Shape();
	star.x = x - 15 + 30 * Math.random();
	star.y = y - 15 + 30 * Math.random();
	star.rotation = parseInt(Math.random() * 360);
	star.graphics.beginStroke("#f0f").beginFill('#ff0').setStrokeStyle(1).drawPolyStar(0, 0, size / 2, 5, 0.6).closePath();
	this.element.addChild(star);

	createjs.Tween.get(star)
		.to({alpha: 0, rotation: star.rotation + 180}, 500 + 500 * Math.random(), createjs.Ease.linear)
		.call(function() {
			this.element.removeChild(star);
		}.bind(this));
};

module.exports = RainbowRoad;
