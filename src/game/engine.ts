import { 
  EnemyMissile, 
  PlayerMissile, 
  Explosion, 
  CityState, 
  BatteryState, 
  Point 
} from './types';

export class GameEngine {
  enemies: EnemyMissile[] = [];
  playerMissiles: PlayerMissile[] = [];
  explosions: Explosion[] = [];
  cities: CityState[] = [];
  batteries: BatteryState[] = [];
  
  score: number = 0;
  gameOver: boolean = false;
  gameWin: boolean = false;
  
  width: number = 800;
  height: number = 600;
  
  private lastTime: number = 0;
  private spawnTimer: number = 0;
  private spawnInterval: number = 2.5; // Medium difficulty

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.reset();
  }

  reset() {
    this.enemies = [];
    this.playerMissiles = [];
    this.explosions = [];
    this.score = 0;
    this.gameOver = false;
    this.gameWin = false;
    this.spawnTimer = 0;
    this.spawnInterval = 2.5;
    this.lastTime = 0; // Reset timer to prevent huge dt on first frame

    // 6 cities
    this.cities = Array.from({ length: 6 }, (_, i) => ({
      x: (this.width / 7) * (i + 1),
      alive: true
    }));

    // 3 batteries
    this.batteries = [
      { x: 40, ammo: 200, maxAmmo: 200, alive: true },
      { x: this.width / 2, ammo: 400, maxAmmo: 400, alive: true },
      { x: this.width - 40, ammo: 200, maxAmmo: 200, alive: true }
    ];
  }

  update(time: number) {
    if (this.gameOver || this.gameWin) return;

    const dt = Math.min((time - this.lastTime) / 1000, 0.1);
    this.lastTime = time;

    // Spawning
    this.spawnTimer += dt;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnEnemy();
      this.spawnTimer = 0;
      // Gradually increase difficulty (Medium ramp up)
      this.spawnInterval = Math.max(0.6, this.spawnInterval * 0.99);
    }

    // Update entities
    this.enemies.forEach(e => {
      if (e && typeof e.update === 'function') e.update(dt);
    });
    this.playerMissiles.forEach(p => {
      if (p && typeof p.update === 'function') p.update(dt);
    });
    this.explosions.forEach(ex => {
      if (ex && typeof ex.update === 'function') ex.update(dt);
    });

    // Handle player missile reaching target
    this.playerMissiles.forEach(p => {
      if (p && p.reachedTarget) {
        const radius = p.isGrenade ? 100 : 40;
        this.explosions.push(new Explosion(Math.random().toString(), p.target, radius));
      }
    });

    // Collision: Explosions vs Enemy Missiles
    this.explosions.forEach(ex => {
      this.enemies.forEach(en => {
        const dx = ex.pos.x - en.current.x;
        const dy = ex.pos.y - en.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < ex.radius) {
          en.isDead = true;
          this.score += en.isGrenade ? 50 : 20;
          if (this.score >= 1000) {
            this.gameWin = true;
          }
        }
      });
    });

    // Handle enemy missile reaching ground
    this.enemies.forEach(en => {
      if (en.isDead && !this.isEnemyDestroyedByExplosion(en)) {
        // Hit target
        if (en.targetCityIndex !== null) {
          this.cities[en.targetCityIndex].alive = false;
        } else if (en.targetBatteryIndex !== null) {
          this.batteries[en.targetBatteryIndex].alive = false;
          this.batteries[en.targetBatteryIndex].ammo = 0;
        }
        const radius = en.isGrenade ? 120 : 40;
        this.explosions.push(new Explosion(Math.random().toString(), en.current, radius));
      }
    });

    // Cleanup
    this.enemies = this.enemies.filter(e => !e.isDead);
    this.playerMissiles = this.playerMissiles.filter(p => !p.isDead);
    this.explosions = this.explosions.filter(ex => !ex.isDead);

    // Check game over
    if (this.batteries.every(b => !b.alive)) {
      this.gameOver = true;
    }
  }

  private isEnemyDestroyedByExplosion(en: EnemyMissile): boolean {
    // If it's dead but didn't reach its end point, it was destroyed
    const dx = en.end.x - en.current.x;
    const dy = en.end.y - en.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist > 5;
  }

  spawnEnemy() {
    const startX = Math.random() * this.width;
    const startY = 0;
    
    // Pick target: city or battery
    const targets: { type: 'city' | 'battery', index: number, x: number }[] = [];
    this.cities.forEach((c, i) => { if (c.alive) targets.push({ type: 'city', index: i, x: c.x }); });
    this.batteries.forEach((b, i) => { if (b.alive) targets.push({ type: 'battery', index: i, x: b.x }); });

    if (targets.length === 0) return;

    const target = targets[Math.floor(Math.random() * targets.length)];
    const isGrenade = Math.random() < 0.12; // 12% chance for grenade
    const speed = isGrenade ? 30 : (40 + Math.random() * 30 + (this.score / 150) * 4);

    this.enemies.push(new EnemyMissile(
      Math.random().toString(),
      { x: startX, y: startY },
      { x: target.x, y: this.height - 20 },
      speed,
      target.type === 'city' ? target.index : null,
      target.type === 'battery' ? target.index : null,
      isGrenade
    ));
  }

  fireMissile(targetX: number, targetY: number, isGrenade: boolean = false) {
    if (this.gameOver || this.gameWin) return;

    // Heat-seeking: Find nearest enemy to click point
    let targetEnemy: EnemyMissile | null = null;
    let minEnemyDist = 120; // Max distance to lock on

    this.enemies.forEach(en => {
      const dx = en.current.x - targetX;
      const dy = en.current.y - targetY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minEnemyDist) {
        minEnemyDist = dist;
        targetEnemy = en;
      }
    });

    // Find closest battery with ammo
    let bestBatteryIndex = -1;
    let minDist = Infinity;

    const ammoCost = isGrenade ? 5 : 1;

    this.batteries.forEach((b, i) => {
      if (b.alive && b.ammo >= ammoCost) {
        const dist = Math.abs(b.x - targetX);
        if (dist < minDist) {
          minDist = dist;
          bestBatteryIndex = i;
        }
      }
    });

    if (bestBatteryIndex !== -1) {
      const battery = this.batteries[bestBatteryIndex];
      battery.ammo -= ammoCost;
      
      // If we found a target enemy, use its current position as the initial target
      const finalTargetX = targetEnemy ? (targetEnemy as EnemyMissile).current.x : targetX;
      const finalTargetY = targetEnemy ? (targetEnemy as EnemyMissile).current.y : targetY;

      this.playerMissiles.push(new PlayerMissile(
        Math.random().toString(),
        { x: battery.x, y: this.height - 20 },
        { x: finalTargetX, y: finalTargetY },
        isGrenade,
        targetEnemy
      ));
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.clearRect(0, 0, this.width, this.height);

    // Background
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, this.width, this.height);

    // Entities
    this.enemies.forEach(e => e.draw(ctx));
    this.playerMissiles.forEach(p => p.draw(ctx));
    this.explosions.forEach(ex => ex.draw(ctx));

    // Ground
    ctx.fillStyle = '#2d2d3a';
    ctx.fillRect(0, this.height - 20, this.width, 20);

    // Cities
    this.cities.forEach(c => {
      if (c.alive) {
        ctx.fillStyle = '#4a9eff';
        ctx.fillRect(c.x - 15, this.height - 35, 30, 15);
        // Windows
        ctx.fillStyle = '#ffff00';
        ctx.fillRect(c.x - 10, this.height - 30, 4, 4);
        ctx.fillRect(c.x + 6, this.height - 30, 4, 4);
      }
    });

    // Batteries
    this.batteries.forEach(b => {
      if (b.alive) {
        ctx.fillStyle = '#ff9f43';
        ctx.beginPath();
        ctx.moveTo(b.x - 20, this.height - 20);
        ctx.lineTo(b.x, this.height - 50);
        ctx.lineTo(b.x + 20, this.height - 20);
        ctx.fill();
      }
    });
  }
}
