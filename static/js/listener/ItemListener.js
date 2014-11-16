
function ItemListener(itemHandler) {
    this.currentItems = 0;
    this.nextItem = 0;
    this.maxItems = 0;
    this.cooldown = 0;
    this.itemHandler = itemHandler;
}

ItemListener.prototype.registerEvents = function(emitter) {
    this.emitter = emitter;
    this.emitter.on('unequip', this.onUnequip.bind(this));
    this.emitter.on('change-level', this.onChangeLevel.bind(this));
};

ItemListener.prototype.onChangeLevel = function(level) {
    this.maxItems = level.itemSwordAmount;
    this.cooldown = level.itemCooldown;
};

ItemListener.prototype.onUnequip = function() {
    this.currentItems--;
};

ItemListener.prototype.tick = function (event) {
    if (this.currentItems >= this.maxItems) {
        return;
    }

    if (this.nextItem > event.timeStamp) {
        return;
    }

    this.itemHandler.spawn();
    this.nextItem = event.timeStamp + this.cooldown * 1000;
    this.currentItems++;
};

module.exports = ItemListener;
