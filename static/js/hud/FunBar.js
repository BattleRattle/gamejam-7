var maxValue = 10;
var autoDecreasePerSecond = 0.5;
var maxWidth = 240;

var constants = require('../GameConsts');

function FunBar() {
    this.element = new createjs.Container();
    this.element.x = constants.GAME_WIDTH / 2 - 125;
    this.current = 0;
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

    this.current++;
    this.current = Math.min(this.current, maxValue);
};

FunBar.prototype.onCombo = function(event) {
    this.current += event.level;
    this.current = Math.min(this.current, maxValue);
};

FunBar.prototype.tick = function(event) {
    if (this.current > 0) {
        this.current -= (event.delta / 1000) * autoDecreasePerSecond;
        this.current = Math.max(this.current, 0);
        this.drawFill();
    }
};

FunBar.prototype.drawFill = function() {
    this.fill.graphics.clear().beginFill("#aaa").drawRect(5, 5, (this.current / maxValue) * maxWidth, 40);
};

module.exports = FunBar;
