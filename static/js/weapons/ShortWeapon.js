var attackDuration = 500;

function ShortWeapon(x, y, rotation, lifetime) {
    this.radius = 20;
    this.element = new createjs.Container();
    this.id = 'item';
    this.element.x = x;
    this.element.y = y;
    this.element.rotation = rotation;

    this.equipped = false;

    var image = new createjs.Bitmap('./img/schwert.png');

    var self = this;
    image.image.onload = function() {
        self.element.regX = self.element.getBounds().width / 2;
        self.element.regY = self.element.getBounds().height / 2;
    };
    this.image = image;
    this.element.scaleX = this.element.scaleY = 0.1;
    this.element.addChild(image);
}

ShortWeapon.prototype.registerEvents = function(emitter) {
    emitter.on('attack', this.onAttack.bind(this));
};

ShortWeapon.prototype.onAttack = function(event) {
    this.canActive = true;
};

ShortWeapon.prototype.tick = function(event) {
    if (this.canActive) {
        this.isActive = true;
        this.canActive = false;
        this.cooldown = event.timeStamp + attackDuration;
    }

    if (this.isActive && this.cooldown < event.timeStamp) {
        this.canActive = false;
        this.isActive = false;
    }
};

ShortWeapon.prototype.getRadius = function () {
    return this.radius;
};

ShortWeapon.prototype.equip = function() {
    this.element.x = 900;
    this.element.y = 0;
    this.element.rotation = 0;
    this.radius = 70;
    this.id = 'short-weapon';
    this.equipped = true;
    this.image.scaleX = this.element.scaleY = 1;
};

module.exports = ShortWeapon;
