
var NightOverlay = function(player) {

	this.element = new createjs.Bitmap('./img/nightmode.png');
	this.player = player;

	this.element.alpha = 0.8;
	this.element.scaleX = this.element.scaleY = 0.6;
	this.element.x = 1024 / 2;
	this.element.y = 768/2;

	this.element.regX = 1195;
	this.element.regY = 1500;
};

NightOverlay.prototype.tick = function(event) {
	this.element.rotation = this.player.element.rotation - 35;
};

module.exports = NightOverlay;
