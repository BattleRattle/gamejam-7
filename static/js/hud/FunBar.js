var maxValue = 10;
var autoDecreasePerSecond = 0.5;
var maxWidth = 240;

var constants = require('../GameConsts');

function FunBar() {
    this.element = new createjs.Container();
    this.element.x = constants.GAME_WIDTH / 2 - 125;
    this.current = 0;
	this.lastIncrease = 0;
    this.boarder = new createjs.Shape();
    this.boarder.graphics.beginFill("#444").drawRect(0, 0, 250, 50);
    this.element.addChild(this.boarder);

    this.fill = new createjs.Shape();
    this.drawFill();
    this.element.addChild(this.fill);
}

FunBar.prototype.registerEvents = function(emitter) {
    emitter.on('hit', this.onHit.bind(this));
    emitter.on('combo', this.onCombo.bind(this));
};

FunBar.prototype.onHit = function(event) {
    if (event.hitTarget == 'player') {
        return;
    }

	this.increase(1);
};

FunBar.prototype.onCombo = function(event) {
    this.increase(event.level);
};

FunBar.prototype.increase = function(value) {
	this.current += value;
	this.current = Math.min(this.current, maxValue);
	this.lastIncrease = new Date().getTime();

	for (var i = 0; i < 15; i++) {
		this.spawnJuicyStar((this.current / maxValue) * maxWidth - 30 + 60 * Math.random(), 50 * Math.random(), 50);
	}
};

FunBar.prototype.tick = function(event) {
    if (this.current > 0) {
        this.current -= (event.delta / 1000) * autoDecreasePerSecond;
        this.current = Math.max(this.current, 0);

		var lastIncreaseDiff = event.timeStamp - this.lastIncrease;
		if (lastIncreaseDiff < 1000) {
			this.drawFill('rgb(' + Math.round(255 - 85 / 1000 * lastIncreaseDiff) + ', ' + Math.round(170 / 1000 * lastIncreaseDiff) + ', ' + Math.round(255 - 85 / 1000 * lastIncreaseDiff) + ')');
		} else {
			this.drawFill();
		}
    }
};

FunBar.prototype.drawFill = function(color) {
	color = (color === undefined) ? '#aaa' : color;
    this.fill.graphics.clear().beginFill(color).drawRect(5, 5, (this.current / maxValue) * maxWidth, 40);
};

FunBar.prototype.spawnJuicyStar = function(x, y, size) {
	var star = new createjs.Shape();

	star.x = x - size / 2;
	star.y = y - size / 2;
	star.rotation = parseInt(Math.random() * 360);
	star.graphics.beginStroke("#f0f").beginFill('#ff0').setStrokeStyle(2).drawPolyStar(0, 0, size / 2 - 15, 5, 0.6).closePath();
	this.element.addChild(star);

	createjs.Tween.get(star)
		.to({y: y + 200, alpha: 0, rotation: (star.rotation + 360) % 360}, 500 + 500 * Math.random(), createjs.Ease.linear)
		.call(function() {
			this.element.removeChild(star);
		}.bind(this));
};

module.exports = FunBar;
