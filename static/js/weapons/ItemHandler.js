var ShortWeapon = require('./ShortWeapon'),
    PseudoRand = require('../util/PseudoRand'),
    CollisionListener = require('../listener/CollisionListener'),
    GameConstants = require('../GameConsts');

var weaponLifeTime = 10;

function ItemHandler() {
    this.element = new createjs.Container();
    this.items = [];

    this.shouldSpawn = false;
    this.listeners = [];

    this.rand = new PseudoRand();
}

ItemHandler.prototype.setTarget = function(target) {
    this.target = target;
};

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
            this.rand.getRandom() % 360,
            weaponLifeTime
        );
        this.element.addChild(item.element);
        this.shouldSpawn = false;
        this.items.push(item);

        var listener = new CollisionListener(this.target, item, 'pickup');
        listener.registerEvents(this.emitter);
        this.listeners.push(listener);
    }

    for (var i = this.items.length - 1; i >= 0; i--) {
        if (!this.items[i].equipped && this.items[i].lifetime <= 0) {
            this.element.removeChild(this.items[i].element);
            this.items.splice(i, 1);
            this.listeners.splice(i, 1);
            continue;
        }

        if (typeof this.items[i]['tick'] == 'function') {
            this.items[i].tick(event);
        }

        console.log(this.items[i].equipped, this.items[i].lifetime)
        if (!this.items[i].equipped && this.items[i].lifetime > 0) {
            this.listeners[i].tick(event);
        }
    }
};

ItemHandler.prototype.registerEvents = function(emitter) {
    emitter.on('change-level', this.onChangeLevel.bind(this));
};

ItemHandler.prototype.onChangeLevel = function(level) {
    this.rand.setSeed(level.itemSeed);
};

module.exports = ItemHandler;
