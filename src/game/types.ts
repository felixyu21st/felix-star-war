export type Point = { x: number; y: number };

export interface Entity {
  id: string;
  update: (dt: number) => void;
  draw: (ctx: CanvasRenderingContext2D) => void;
  isDead: boolean;
}

export class EnemyMissile implements Entity {
  id: string;
  start: Point;
  end: Point;
  current: Point;
  speed: number;
  isDead: boolean = false;
  targetCityIndex: number | null; // null if targeting a battery
  targetBatteryIndex: number | null;
  isGrenade: boolean = false;

  constructor(id: string, start: Point, end: Point, speed: number, targetCityIndex: number | null, targetBatteryIndex: number | null, isGrenade: boolean = false) {
    this.id = id;
    this.start = { ...start };
    this.end = { ...end };
    this.current = { ...start };
    this.speed = speed;
    this.targetCityIndex = targetCityIndex;
    this.targetBatteryIndex = targetBatteryIndex;
    this.isGrenade = isGrenade;
  }

  update(dt: number) {
    const dx = this.end.x - this.current.x;
    const dy = this.end.y - this.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist < 2) {
      this.isDead = true;
      return;
    }

    const vx = (dx / dist) * this.speed * dt;
    const vy = (dy / dist) * this.speed * dt;
    
    this.current.x += vx;
    this.current.y += vy;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.beginPath();
    ctx.moveTo(this.start.x, this.start.y);
    ctx.lineTo(this.current.x, this.current.y);
    ctx.strokeStyle = this.isGrenade ? '#ffaa00' : '#ff4444';
    ctx.lineWidth = this.isGrenade ? 3 : 1;
    ctx.stroke();

    ctx.fillStyle = this.isGrenade ? '#ffaa00' : '#ff4444';
    if (this.isGrenade) {
      ctx.beginPath();
      ctx.arc(this.current.x, this.current.y, 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(this.current.x - 1, this.current.y - 1, 2, 2);
    }
  }
}

export class PlayerMissile implements Entity {
  id: string;
  start: Point;
  target: Point;
  current: Point;
  speed: number = 650; // Increased from 400
  isDead: boolean = false;
  reachedTarget: boolean = false;
  isGrenade: boolean = false;
  targetEnemy: EnemyMissile | null = null;

  constructor(id: string, start: Point, target: Point, isGrenade: boolean = false, targetEnemy: EnemyMissile | null = null) {
    this.id = id;
    this.start = { ...start };
    this.target = { ...target };
    this.current = { ...start };
    this.isGrenade = isGrenade;
    this.targetEnemy = targetEnemy;
    if (isGrenade) {
      this.speed = 450; // Increased from 250
    }
  }

  update(dt: number) {
    // Heat seeking logic: update target to enemy's current position
    if (this.targetEnemy && !this.targetEnemy.isDead) {
      this.target = { ...this.targetEnemy.current };
    }

    const dx = this.target.x - this.current.x;
    const dy = this.target.y - this.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 5) {
      this.reachedTarget = true;
      this.isDead = true;
      return;
    }

    const vx = (dx / dist) * this.speed * dt;
    const vy = (dy / dist) * this.speed * dt;

    this.current.x += vx;
    this.current.y += vy;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.beginPath();
    ctx.moveTo(this.start.x, this.start.y);
    ctx.lineTo(this.current.x, this.current.y);
    ctx.strokeStyle = this.isGrenade ? '#ffff44' : '#44ff44';
    ctx.lineWidth = this.isGrenade ? 2 : 1;
    ctx.stroke();

    // Draw target marker
    ctx.beginPath();
    const size = this.isGrenade ? 6 : 3;
    ctx.moveTo(this.target.x - size, this.target.y - size);
    ctx.lineTo(this.target.x + size, this.target.y + size);
    ctx.moveTo(this.target.x + size, this.target.y - size);
    ctx.lineTo(this.target.x - size, this.target.y + size);
    ctx.strokeStyle = this.isGrenade ? '#ffff44' : '#ffffff';
    ctx.stroke();
  }
}

export class Explosion implements Entity {
  id: string;
  pos: Point;
  radius: number = 0;
  maxRadius: number = 40;
  growthRate: number = 60;
  isDead: boolean = false;
  shrinking: boolean = false;

  constructor(id: string, pos: Point, maxRadius: number = 40) {
    this.id = id;
    this.pos = { ...pos };
    this.maxRadius = maxRadius;
  }

  update(dt: number) {
    if (!this.shrinking) {
      this.radius += this.growthRate * dt;
      if (this.radius >= this.maxRadius) {
        this.shrinking = true;
      }
    } else {
      this.radius -= (this.growthRate / 2) * dt;
      if (this.radius <= 0) {
        this.isDead = true;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0, 0.3 + (this.radius / this.maxRadius) * 0.5)})`;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

export interface CityState {
  x: number;
  alive: boolean;
}

export interface BatteryState {
  x: number;
  ammo: number;
  maxAmmo: number;
  alive: boolean;
}
