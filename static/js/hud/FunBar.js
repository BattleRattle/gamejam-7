var maxValue = 10;
var funTime = 7500;
var autoDecreasePerSecond = 0.5;
var maxWidth = 240;
var juicyStarCount = 15;
var maxMagicLevel = 5;

var constants = require('../GameConsts');

function FunBar() {
    this.element = new createjs.Container();
    this.element.x = constants.GAME_WIDTH / 2 - 125;
    this.current = 0;
	this.lastIncrease = 0;
    this.boarder = new createjs.Shape();
    this.boarder.graphics.beginFill("#333").drawRect(0, 0, 250, 50);
    this.element.addChild(this.boarder);

    this.fill = new createjs.Shape();
    this.drawFill();
    this.element.addChild(this.fill);

	this.isFunTime = false;
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
	if (this.current >= maxValue && this.isFunTime == false) {
		this.canFunTime = true;
	}

	this.current = Math.min(this.current, maxValue);

	this.lastIncrease = new Date().getTime();

	for (var i = 0; i < juicyStarCount + 1; i++) {
		this.spawnJuicyStar(5 + this.getMaxOffsetOnBar() / juicyStarCount * i - 20 + 40 * Math.random(), 50 * Math.random(), 40);
	}

	var magicLevel = parseInt(this.current / maxValue * maxMagicLevel);
	createjs.Sound.play('magic' + magicLevel);
};

FunBar.prototype.tick = function(event) {
    if (this.current > 0) {
		if (this.isFunTime && event.timeStamp < this.funTimeEnd) {
			this.spawnJuicyStar(5 + this.getMaxOffsetOnBar() * Math.random() - 20 + 40 * Math.random(), 50 * Math.random(), 40);
		} else {
			this.isFunTime = false;

			this.current -= (event.delta / 1000) * autoDecreasePerSecond;
			this.current = Math.max(this.current, 0);

			var lastIncreaseDiff = event.timeStamp - this.lastIncrease;
			if (lastIncreaseDiff < 1000) {
				// fade from rgb(255, 0, 255) to rgb(255, 255, 0)
				this.drawFill('rgb(255, ' + Math.round(255 / 1000 * lastIncreaseDiff) + ', ' + Math.round(255 - 255 / 1000 * lastIncreaseDiff) + ')');
			} else {
				this.drawFill();
			}
		}
    }

	if (this.canFunTime) {
		this.isFunTime = true;
		this.canFunTime = false;
		this.funTimeEnd = event.timeStamp + funTime;
	}
};

FunBar.prototype.getMaxOffsetOnBar = function() {
	return (this.current / maxValue) * maxWidth;
};

FunBar.prototype.drawFill = function(color) {
	color = (color === undefined) ? '#ff0' : color;
    this.fill.graphics.clear().beginFill(color).drawRect(5, 5, (this.current / maxValue) * maxWidth, 40);
};

FunBar.prototype.spawnJuicyStar = function(x, y, size) {
	size *= (0.8 + 0.4 * Math.random());

	var star = new createjs.Shape();
	star.x = x;
	star.y = y;
	star.rotation = parseInt(Math.random() * 360);
	star.graphics.beginStroke("#f0f").beginFill('#ff0').setStrokeStyle(2).drawPolyStar(0, 0, size / 2 - 15, 5, 0.6).closePath();
	this.element.addChild(star);

	createjs.Tween.get(star)
		.to({y: y + 200, alpha: 0, rotation: star.rotation + 180}, 500 + 500 * Math.random(), createjs.Ease.linear)
		.call(function() {
			this.element.removeChild(star);
		}.bind(this));
};

module.exports = FunBar;
