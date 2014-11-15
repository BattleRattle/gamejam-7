var attackDuration = 500;

function ShortWeapon() {
    this.radius = 60;
    this.id = 'short-weapon';
    this.active = true;

    this.element = new createjs.Container();

    var image = new createjs.Bitmap('./img/schwert.png');
    this.element.scaleX = this.element.scaleY = 1;

    var self = this;
    image.image.onload = function() {
        self.element.regX = self.element.getBounds().width / 2;
        self.element.regY = self.element.getBounds().height / 2;
    };
    image.x = 900;
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


module.exports = ShortWeapon;
