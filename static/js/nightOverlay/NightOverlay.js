
var NightOverlay = function(player) {
	this.c = 0;

	this.element = new createjs.Container();

	var img = new createjs.Bitmap('./img/nightmode.png');
	this.player = player;

	this.element.alpha = 0;
	img.scaleX = img.scaleY = 0.6;
	img.x = 1024 / 2;
	img.y = 768/2;

	img.regX = 1150;
	img.regY = 1450;

	this.img = img;
	this.element.addChild(img);
};

NightOverlay.prototype.tick = function(event) {
	var speed = this.player.velocity.length();

	this.c += event.delta * speed  / (80 * 1000);
	this.img.rotation = this.player.element.rotation - 35 + Math.sin(this.c) * 10;
};

NightOverlay.prototype.onChangeLevel = function(level) {
	this.element.alpha = level.darkness;
};

NightOverlay.prototype.registerEvents = function(emitter) {
	emitter.on('change-level', this.onChangeLevel.bind(this));
};

module.exports = NightOverlay;
