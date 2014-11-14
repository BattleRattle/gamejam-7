var maxWidth = 240;

var constants = require('../GameConsts');

function HealthBar(left, object) {
    this.object = object;

    this.element = new createjs.Container();
    this.element.x = left ? 10 : constants.GAME_WIDTH - 260;
    this.current = 0;
    this.boarder = new createjs.Shape();
    this.boarder.graphics.beginFill("#444").drawRect(0, 0, 250, 50);
    this.element.addChild(this.boarder);

    this.fill = new createjs.Shape();
    this.drawFill();
    this.element.addChild(this.fill);
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
    this.fill.graphics.clear().beginFill("#aaa").drawRect(5, 5, (this.object.health / this.object.maxHealth) * maxWidth, 40);
};

module.exports = HealthBar;
