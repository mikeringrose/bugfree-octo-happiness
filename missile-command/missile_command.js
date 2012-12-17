$(document).ready(function() {
    var container = $('#container'),
        screen_height = container.height(),
        screen_width = container.width(),
        refresh_rate = 1 / 30,
        explosion_colors = ['#fefefe', '#ff82ab', '#63b8ff'],
        game_over   = 'game-over',
        level_over  = 'level-over',
        item_dead   = 'item-dead', 
        boom_life   = 225,
        pixel_len   = 5,
        target, level;


    //- aim
    $(document).mousemove(function(event) {
        target = {
            x: event.pageX,
            y: screen_height - event.pageY
        };
    });

    //- fire missile
    $(document).keypress(
        function(event) {
            var which = event.which;

            switch (which) {
            case 32:
                startGame();
                break;
            case 49:
            case 50:
            case 51:
                level.events.push({
                    handler: fireFromBase,
                    base: (which - 49),
                    target: target
                });
                break;
            default:
                break;
            }
        }
    );

    function startGame() {
        level = { level: 1, num_missiles: 16, items: [], events: [] };
        $('#start-screen').remove();    
        startLevel();
    }

    function endGame() {
    }

    function startLevel() {
        setTimeout(loop, refresh_rate);
        setTimeout(fireEnemyMissiles, 2000);
    }

    function nextLevel() {
    }

    function getGameState() {
        var state = null;

        if ($('.city').length == 0) {
            state = game_over;
        }
        else if (level.enemy_missiles == 0) {
            state = level_over;
        }

        return state;
    }

    function loop() {
        var state = getGameState(level),
            events = level.events,
            items = level.items,
            keep = [],
            i, j, item, other;

        if (state == game_over) {
            endGame();
        }
        else if (state == level_over) {
            nextLevel();
        }
        else {
            while (event = events.shift()) {
                var handlerFunc = event.handler;
                handlerFunc.call(event);
            }

            for (i = 0; item = items[i]; i++) {
                var updateFunc = item.update;
                updateFunc.call(item);
            }

            for (i = 0; item = items[i]; i++) {
                for (j = 0; other = items[j]; j++) {
                    if (item.$el.hasClass("enemy") && other.$el.hasClass("boom")) {
                        var missilePos = item.$el.find(".missile_trail:last-child").offset(),
                            boomPos = other.$el.offset(),
                            radius = other.radius;

                        if (missilePos && boomPos && distance({x: missilePos.left, y: screen_height - missilePos.top},
                                {x: boomPos.left + radius/2, y: screen_height - boomPos.top - radius / 2}) < radius) {
                            item.state = item_dead;
                        }
                    }
                }
            }

            for (i = 0; item = items[i]; i++) {
                var renderFunc = item.render,
                    disposeFunc = item.dispose;

                if (item.state == item_dead) {
                    disposeFunc.call(item);
                }
                else {
                    renderFunc.call(item);
                    keep.push(item);
                }
            }

            level.items = keep;

            setTimeout(loop, refresh_rate);
        }
    }

    function fireEnemyMissiles() {
        var i, city, launchX;

        if (level.num_missiles == 0)
            return;

        for (i = 0; i < 4; i++, level.num_missiles--) {
            launchX = Math.floor(Math.random() * screen_width);
            city = $(".city:eq(" + Math.floor(Math.random() * 6) + ")");
            level.events.push({
                handler:    launchEnemyMissile,
                from:       { x: launchX,     y: screen_height },
                to:         { x: city.position().left + city.width(),   y: 10 },
                speed:      .5,
                className:  "enemy"
            });
        }

        setTimeout(fireEnemyMissiles, 6000);
    }

    function updateMissile() {
        this.pos.x += this.vel.x;
        this.pos.y += this.vel.y;

        if (Math.abs(this.pos.x - this.target.x) <= Math.abs(this.vel.x) 
            && Math.abs(this.pos.y - this.target.y) <= Math.abs(this.vel.y)) {
            level.events.push({
                handler: explode,
                target: this.target
            });

            this.state = item_dead;
        }
    }

    function renderMissile() {
        var head = $(this.el),
            trail;

        if (!this.lastPos || distance(this.lastPos, this.pos) >= pixel_len) {
            this.lastPos = { x: this.pos.x, y: this.pos.y };

            trail = $('<div class="missile_trail"></div>');

            trail.css("left", this.pos.x + "px");
            trail.css("bottom", this.pos.y + "px");

            head.append(trail);
        }
    }

    function disposeMissile() {
        $(this.el).remove();
    }

    function updateBoom() {
        var pos = this.position;
        
        if (this.radius < 50) {
            this.radius += 1;
        }
        else if (this.life > 0) {
            this.life -= 1;
        }
        else {
            this.state = item_dead;
        }
    }

    function renderBoom() {
        var pos = this.position,
            boom = this.$el,
            radius = this.radius,
            diameter = radius * 2;

        boom.css('backgroundColor', explosion_colors[this.radius % 3]);
        boom.css('opacity', this.life / boom_life);

        boom.offset({
            left: pos.x - radius,
            top: screen_height - pos.y - radius
        });

        boom.width(diameter);
        boom.height(diameter);
    }

    function disposeBoom() {
        this.$el.remove();
    }

    function explode() {
        var $el = $('<div class="boom"></div>');
        container.append($el);

        level.items.push({
            $el: $el,
            position: this.target,
            radius: 0,
            life: boom_life,
            update: updateBoom,
            render: renderBoom,
            dispose: disposeBoom
        });
    }

    function fireFromBase() {
        var base = $('#base' + this.base),
            baseX = base.position().left + base.width(),
            speed = base.data('speed');    

        launchMissile({
            from:   { x: baseX, y: 10 },
            to:     this.target,
            speed:  base.data('speed')
        });
    }

    function launchEnemyMissile() {
        launchMissile(this);
    }

    function launchMissile(options) {
        var from    = options.from,
            to      = options.to,
            speed   = options.speed,
            className   = options.className,        
            velocity    = calcVelocity(from, to, speed),
            missileEl   = $('<div class="missile"></div>');

        if (className) {
            missileEl.addClass(className);
        }

        container.append(missileEl);

        level.items.push({
            el: missileEl,
            $el: $(missileEl),
            vel: velocity,
            pos: from,
            target: to,
            update: updateMissile,
            render: renderMissile,
            dispose: disposeMissile
        });
    }

    function calcVelocity(from, to, speed) {
        var vec = {
                x: to.x - from.x,
                y: to.y - from.y
            },
            len = Math.sqrt(Math.pow(vec.x, 2) + Math.pow(vec.y, 2)),
            norm = {
                x: vec.x / len,
                y: vec.y / len
            },
            vel = {
                x: norm.x * speed,
                y: norm.y * speed
            };

        return vel;
    }

    function distance(p1, p2) {
        return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2))
    }
});