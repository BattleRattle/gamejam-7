var maxItems = 7,
    cooldown = 10000;

function ItemListener(itemHandler) {
    this.currentItems = 0;
    this.nextItem = 0;

    this.itemHandler = itemHandler;
}

ItemListener.prototype.registerEvents = function(emitter) {
    this.emitter = emitter;
    this.emitter.on('unequip', this.onUnequip.bind(this));
};

ItemListener.prototype.onUnequip = function() {
    this.currentItems--;
};

ItemListener.prototype.tick = function (event) {
    if (this.currentItems >= maxItems) {
        return;
    }

    if (this.nextItem > event.timeStamp) {
        return;
    }

    this.itemHandler.spawn();
    this.nextItem = event.timeStamp + cooldown;
    this.currentItems++;
};

module.exports = ItemListener;
