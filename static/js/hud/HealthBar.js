var maxWidth = 240;

var constants = require('../GameConsts');

function HealthBar(left, object) {
    this.object = object;

    this.element = new createjs.Container();
    this.element.x = left ? 45 : constants.GAME_WIDTH - 260;
	this.element.y = 10;
    this.current = 0;

    this.border = new createjs.Shape();
    this.border.graphics.beginFill("#444").drawRect(0, 0, 250, 50);
    this.element.addChild(this.border);

    this.fill = new createjs.Shape();
    this.drawFill();
    this.element.addChild(this.fill);

	this.funText = new createjs.Text(left ? "♥" : "☠", "30px Komika", left ? '#f8f' : '#d00');
	this.funText.x = -35;
	this.funText.y = -4;
	this.element.addChild(this.funText);
}

HealthBar.prototype.registerEvents = function(emitter) {
    emitter.on('hit', this.onHit.bind(this));
};

HealthBar.prototype.onHit = function(event) {
    if (event.hitTarget !== this.object.id ) {
        return;
    }

    this.drawFill();
};

HealthBar.prototype.drawFill = function() {
	var color = (this.object.id === 'player') ? '#f8f' : '#d00';
    this.fill.graphics.clear().beginFill(color).drawRect(5, 5, (this.object.health / this.object.maxHealth) * maxWidth, 40);
};

module.exports = HealthBar;
