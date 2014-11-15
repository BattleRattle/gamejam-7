var ShortWeapon = require('./ShortWeapon'),
    PseudoRand = require('../util/PseudoRand'),
    CollisionListener = require('../listener/CollisionListener'),
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
            this.rand.getRandom() % 360, weaponLifeTime
        );
        this.element.addChild(item.element);
        this.shouldSpawn = false;
        this.items.push(item);

        var listener = new CollisionListener(this.target, item, 'pickup');
        listener.registerEvents(this.emitter);
        this.listeners.push(listener);
    }

    for (var i = this.items.length - 1; i >= 0; i--) {
        if (this.items[i].equipped && this.items[i].lifetime < event.timeStamp) {
            this.element.removeChild(this.items[i].element);
            this.items.splice(i, 1);
            this.listeners.splice(i, 1);
            continue;
        }

        if (typeof this.items[i]['tick'] == 'function') {
            this.items[i].tick(event);
        }

        if (!this.items[i].equipped || !this.target.weapon) {
            this.listeners[i].tick(event);
        }
    }
};

module.exports = ItemHandler;
