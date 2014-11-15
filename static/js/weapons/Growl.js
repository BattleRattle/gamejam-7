var growlSpeed = 300;

function Growl(x, y, rotation, lifetime) {
    this.id = 'growl';

    this.element = new createjs.Container();

    var shape = new createjs.Shape();
    shape.graphics
        .beginFill("#F0F")
        .drawCircle(0, 0, 20);

    this.element.addChild(shape);
    this.rotation = rotation;
    this.element.x = x;
    this.element.y = y;
    this.lifetime = lifetime;
}

Growl.prototype.hit = function() {
    this.lifetime = 0;
};

Growl.prototype.isShortAttacking = function() {
    return true;
};

Growl.prototype.getRadius = function() {
    return 20;
};

Growl.prototype.tick = function(event) {
    this.element.x += Math.cos((this.rotation - 90) / 180 * Math.PI) * growlSpeed * event.delta / 1000;
    this.element.y += Math.sin((this.rotation - 90) / 180 * Math.PI) * growlSpeed * event.delta / 1000;
};

module.exports = Growl;
