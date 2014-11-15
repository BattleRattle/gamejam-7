
var NightOverlay = function(player) {

	this.element = new createjs.Container();

	var img = new createjs.Bitmap('./img/nightmode.png');
	this.player = player;

	this.element.alpha = 0.7;
	img.scaleX = img.scaleY = 0.6;
	img.x = 1024 / 2;
	img.y = 768/2;

	img.regX = 1195;
	img.regY = 1500;

	this.img = img;
	this.element.addChild(img);
};

NightOverlay.prototype.tick = function(event) {
	this.img.rotation = this.player.element.rotation - 35;
};

module.exports = NightOverlay;
