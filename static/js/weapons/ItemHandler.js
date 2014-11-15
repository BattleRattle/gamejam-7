var ShortWeapon = require('./ShortWeapon'),
    PseudoRand = require('../util/PseudoRand'),
    GameConstants = require('../GameConsts');

var weaponLifeTime = 15000;

function ItemHandler() {
    this.element = new createjs.Container();
    this.items = [];

    this.shouldSpawn = false;
    this.listeners = [];

    this.rand = new PseudoRand();
    this.rand.setSeed(2);
}

ItemHandler.prototype.spawn = function() {
    this.shouldSpawn = true;
};

ItemHandler.prototype.reset = function() {
    this.items = [];
    this.listeners = [];
    this.element.removeAllChildren();
};

ItemHandler.prototype.tick = function(event) {
    if (this.shouldSpawn) {
        var item = new ShortWeapon(
            this.rand.getRandom() % GameConstants.GAME_WIDTH,
            this.rand.getRandom() & GameConstants.GAME_HEIGHT,
            this.rand.getRandom() % 360, weaponLifeTime
        );
        this.element.addChild(item.element);
        this.shouldSpawn = false;
        this.items.push(item);
    }
};

module.exports = ItemHandler;
