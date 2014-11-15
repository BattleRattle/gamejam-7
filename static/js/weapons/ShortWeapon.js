var attackDuration = 500;

function ShortWeapon() {
    this.radius = 60;
    this.id = 'short-weapon';
    this.active = true;

    this.element = new createjs.Container();

    this.shape = new createjs.Shape();
    this.drawNormal();
    this.element.addChild(this.shape);
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
        this.drawAttack();
    }

    if (this.isActive && this.cooldown < event.timeStamp) {
        this.canActive = false;
        this.isActive = false;
        this.shape.graphics.clear();
    }
};

ShortWeapon.prototype.drawNormal = function() {
    this.shape.graphics.clear();
};

ShortWeapon.prototype.drawAttack = function() {
    //this.shape.graphics
    //    .beginFill("#F0F")
    //    .drawCircle(0, 0, 1200);
};


module.exports = ShortWeapon;
