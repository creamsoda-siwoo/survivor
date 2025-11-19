'use client';

import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

// --- Constants & Configuration ---
const BOSS_SPAWN_TIME = 60; 
const SHOP_BASE_COST = 30;
const GACHA_COST = 300;
const SKIN_COST = 1000;

// --- Data Definitions ---
const CLASSES = [
    { id: 'soldier', name: '솔저', desc: '균형 잡힌 전투 요원', stats: { hp: 0, dmg: 0, spd: 0, cd: 0 }, cost: 0, icon: '🪖' },
    { id: 'guardian', name: '가디언', desc: '체력 +50, 이동속도 -10%', stats: { hp: 50, dmg: 0, spd: -0.5, cd: 0 }, cost: 1000, icon: '🛡️' },
    { id: 'assassin', name: '어쌔신', desc: '공격력 +30%, 체력 -30', stats: { hp: -30, dmg: 0.3, spd: 1.0, cd: 0 }, cost: 2000, icon: '🗡️' },
    { id: 'mage', name: '아크메이지', desc: '쿨타임 -10%, 체력 -20', stats: { hp: -20, dmg: 0.1, spd: 0, cd: 0.1 }, cost: 3000, icon: '🔮' }
];

const SKINS = [
    { id: 'default', name: '기본', icon: '⏺️' },
    { id: 'neko', name: '이프냥', icon: '🐱' },
    { id: 'bot', name: '로봇', icon: '🤖' },
    { id: 'star', name: '스타', icon: '⭐' },
    { id: 'demon', name: '데몬', icon: '😈' },
    { id: 'alien', name: '외계인', icon: '👽' }
];

const ARTIFACTS = [
    { id: 'cube', name: '고대 큐브', desc: '공격력 +10%', icon: '🧊' },
    { id: 'feather', name: '바람의 깃털', desc: '이동속도 +5%', icon: '🪶' },
    { id: 'chip', name: 'AI 칩셋', desc: '쿨타임 감소 -5%', icon: '💾' },
    { id: 'magnet', name: '초전도 자석', desc: '자석 범위 +20%', icon: '🧲' },
    { id: 'fang', name: '흡혈의 송곳니', desc: '처치 시 체력 회복 +1', icon: '🧛' },
    { id: 'axe', name: '광전사의 도끼', desc: '체력이 낮을수록 강해짐', icon: '🪓' },
    { id: 'watch', name: '정지된 시계', desc: '적 이동속도 -10%', icon: '⏱️' },
    { id: 'thorn', name: '가시 갑옷', desc: '피격 시 반사 피해', icon: '🌵' }
];

const UPGRADES = [
    { id: 'blaster', name: '블래스터 강화', desc: '기본 무기 공격력/속도 증가', type: 'WEAPON', icon: '🔫' },
    { id: 'orbit', name: '위성 포격', desc: '주변을 도는 에너지 볼 추가', type: 'WEAPON', icon: '🪐' },
    { id: 'field', name: '전기장', desc: '주변 적에게 지속 피해', type: 'WEAPON', icon: '⚡' },
    { id: 'tesla', name: '테슬라 코일', desc: '연쇄 번개 공격', type: 'WEAPON', icon: '🌩️' },
    { id: 'missile', name: '유도 미사일', desc: '적을 추적하여 폭발', type: 'WEAPON', icon: '🚀' },
    { id: 'gravity', name: '중력 붕괴', desc: '적을 끌어당기는 블랙홀', type: 'WEAPON', icon: '🌌' },
    { id: 'heal', name: '긴급 수리', desc: '체력 30% 회복', type: 'STAT', icon: '❤️' }
];

const ACHIEVEMENT_LIST = [
    { id: 'novice_killer', name: '신병', desc: '적 1000마리 처치', target: { type: 'kills', val: 1000 }, reward: 500 },
    { id: 'veteran', name: '베테랑', desc: '적 10000마리 처치', target: { type: 'kills', val: 10000 }, reward: 2000 },
    { id: 'slayer', name: '학살자', desc: '적 50000마리 처치', target: { type: 'kills', val: 50000 }, reward: 5000 },
    { id: 'survivor_10', name: '생존자', desc: '총 10분 생존', target: { type: 'time', val: 600 }, reward: 500 },
    { id: 'survivor_60', name: '마스터', desc: '총 60분 생존', target: { type: 'time', val: 3600 }, reward: 3000 },
    { id: 'rich', name: '부자', desc: '누적 코인 10000', target: { type: 'coins', val: 10000 }, reward: 1000 }
];

// --- Game Engine State Container ---
let saveData: any = null;
let currentUserId: string = 'guest'; // Track currently logged in user

const state: any = {
    running: false, paused: false, gameOver: false,
    lastTime: 0, time: 0, score: 0, kills: 0, coins: 0, level: 1, xp: 0, nextLevelXp: 10,
    keys: { w: false, a: false, s: false, d: false, space: false },
    pointer: { x: 0, y: 0, down: false, id: null },
    joystick: { active: false, originX: 0, originY: 0, dx: 0, dy: 0 },
    lastTap: 0,
    player: null, enemies: [], particles: [], items: [], projectiles: [], boss: null,
    weapons: {
        blaster: { level: 1, cd: 0, maxCd: 40, evolved: false },
        orbit: { level: 0, cd: 0, angle: 0, count: 1 },
        field: { level: 0, cd: 0, radius: 80 },
        tesla: { level: 0, cd: 0, maxCd: 120 },
        missile: { level: 0, cd: 0, maxCd: 80 },
        gravity: { level: 0, cd: 0, maxCd: 300 }
    },
    ult: { ready: true, charge: 100, cd: 0, maxCd: 1800 },
    popups: [],
    gravityWells: []
};

// --- Helper Functions (Outside Component) ---

// Load data for specific user
function loadSaveData(userId: string) {
    if (typeof window === 'undefined') return;
    currentUserId = userId;
    const key = `ifko_save_v9_${userId}`;
    const d = localStorage.getItem(key);
    
    const DEFAULT_DATA = {
        coins: 0,
        currentSkin: 'default',
        ownedSkins: ['default'],
        currentClass: 'soldier',
        ownedClasses: ['soldier'],
        upgrades: { damage: 0, health: 0, speed: 0, greed: 0, cooldown: 0, magnet: 0, crit: 0, regen: 0, revive: 0 },
        equipment: { weapon: 0, armor: 0, boots: 0 },
        artifacts: {},
        achievements: [],
        stats: { totalKills: 0, totalTime: 0, totalCoins: 0 }
    };
    
    if(!d) {
        saveData = JSON.parse(JSON.stringify(DEFAULT_DATA));
    } else {
        const parsed = JSON.parse(d);
        saveData = { ...DEFAULT_DATA, ...parsed };
        if(!saveData.upgrades.cooldown) saveData.upgrades.cooldown = 0;
        if(!saveData.stats) saveData.stats = { totalKills: 0, totalTime: 0, totalCoins: 0 };
    }
}

function save() {
    if (typeof window !== 'undefined' && saveData) {
        const key = `ifko_save_v9_${currentUserId}`;
        localStorage.setItem(key, JSON.stringify(saveData));
    }
}

// --- Game Logic Classes ---

class PopupText {
    text: string; x: number; y: number; color: string; life: number;
    constructor(text: string, x: number, y: number, color: string) { this.text = text; this.x = x; this.y = y; this.color = color; this.life = 30; }
    update() { this.y -= 1; this.life--; return this.life <= 0; }
    draw(ctx: CanvasRenderingContext2D) { ctx.fillStyle = this.color; ctx.font = "12px 'Exo 2'"; ctx.fillText(this.text, this.x, this.y); }
}

class Particle {
    x: number; y: number; color: string; vx: number; vy: number; life: number; maxLife: number; size: number;
    constructor(x: number, y: number, color: string, speed: number, life: number) {
        this.x = x; this.y = y; this.color = color; 
        const angle = Math.random() * Math.PI * 2; 
        this.vx = Math.cos(angle) * speed * Math.random(); 
        this.vy = Math.sin(angle) * speed * Math.random(); 
        this.life = life; this.maxLife = life; this.size = Math.random() * 3 + 1;
    }
    update() { this.x += this.vx; this.y += this.vy; this.life--; this.vx *= 0.95; this.vy *= 0.95; return this.life <= 0; }
    draw(ctx: CanvasRenderingContext2D) { ctx.fillStyle = this.color; ctx.globalAlpha = this.life / this.maxLife; ctx.beginPath(); ctx.rect(this.x, this.y, this.size, this.size); ctx.fill(); ctx.globalAlpha = 1; }
}

function createPopup(text: string, x: number, y: number, color: string) { state.popups.push(new PopupText(text, x, y, color)); }
function createExplosion(x: number, y: number, color: string, count: number) { for(let i=0; i<count; i++) state.particles.push(new Particle(x, y, color, 5, 30)); }

class Item {
    x: number; y: number; val: number; size: number; type: string; isCoin: boolean; color: string;
    constructor(x: number, y: number, val: number, type = 'XP') {
        this.x = x; this.y = y; this.val = val; this.size = 5; this.type = type; this.isCoin = false;
        if (type === 'HEAL') { this.color = '#ff0055'; this.size = 8; }
        else if (type === 'MAGNET') { this.color = '#0055ff'; this.size = 8; }
        else if (type === 'BOMB') { this.color = '#ffaa00'; this.size = 8; }
        else { this.isCoin = Math.random() < 0.25; if (this.isCoin) { this.color = '#ffd700'; this.val = 50 * (1 + saveData.upgrades.greed * 0.1); } else { this.color = '#33ccff'; } }
    }
    update(player: any) {
        const dx = player.x - this.x, dy = player.y - this.y, dist = Math.sqrt(dx*dx + dy*dy);
        let range = 100 + (saveData.artifacts.magnet || 0) * 20 + (saveData.upgrades.magnet || 0) * 30; if (this.type === 'MAGNET') range = 150;
        if (dist < range) { this.x += (dx / dist) * 12; this.y += (dy / dist) * 12; }
        if (dist < player.size + this.size) {
            if (this.type === 'HEAL') { player.hp = Math.min(player.hp + 30, player.maxHp); createPopup("+30 HP", this.x, this.y, '#f00'); }
            else if (this.type === 'MAGNET') { state.items.forEach((i: any) => { if(i.type === 'XP' || i.isCoin) { i.x = player.x; i.y = player.y; } }); createPopup("MAGNET!", this.x, this.y, '#00f'); }
            else if (this.type === 'BOMB') { state.enemies.forEach((e: any) => { if(!(e instanceof Boss)) e.die(); else e.takeDamage(500); }); createExplosion(player.x, player.y, '#fff', 50); createPopup("BOOM!", this.x, this.y, '#fa0'); }
            else if (this.isCoin) { state.coins += this.val; saveData.stats.totalCoins += this.val; } else { addXp(this.val); }
            return true;
        } return false;
    }
    draw(ctx: CanvasRenderingContext2D) { 
        ctx.fillStyle = this.color; ctx.beginPath(); 
        if(this.type === 'HEAL') { ctx.rect(this.x-3, this.y-8, 6, 16); ctx.rect(this.x-8, this.y-3, 16, 6); }
        else if(this.type === 'BOMB') { ctx.arc(this.x, this.y, 8, 0, Math.PI*2); }
        else if(this.type === 'MAGNET') { ctx.arc(this.x, this.y, 8, Math.PI, 0); ctx.lineTo(this.x+8, this.y+8); ctx.lineTo(this.x+4, this.y+8); ctx.lineTo(this.x+4, this.y); ctx.lineTo(this.x-4, this.y); ctx.lineTo(this.x-4, this.y+8); ctx.lineTo(this.x-8, this.y+8); }
        else if(this.isCoin) ctx.arc(this.x, this.y, 6, 0, Math.PI*2); else ctx.rect(this.x-3, this.y-3, 6, 6); 
        ctx.fill(); 
    }
}

class Projectile {
    x: number; y: number; vx: number; vy: number; dmg: number; color: string; duration: number; size: number; pierce: boolean; hitList: any[];
    constructor(x: number, y: number, vx: number, vy: number, dmg: number, color: string, duration: number, size=4, pierce=false) { this.x = x; this.y = y; this.vx = vx; this.vy = vy; this.dmg = dmg; this.color = color; this.duration = duration; this.size = size; this.pierce = pierce; this.hitList = []; }
    update() { this.x += this.vx; this.y += this.vy; this.duration--; return this.duration <= 0; }
    draw(ctx: CanvasRenderingContext2D) { ctx.fillStyle = this.color; ctx.shadowBlur = 10; ctx.shadowColor = this.color; ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI*2); ctx.fill(); ctx.shadowBlur = 0; }
}

class Player {
    x: number; y: number; maxHp: number; hp: number; speed: number; dmgMult: number; cdReduc: number; size: number; invuln: number; dashCd: number; dashTime: number; dashVec: any; skin: string; critChance: number; regenRate: number; revives: number;
    constructor() {
        this.x = 0; this.y = 0;
        const job = CLASSES.find(c => c.id === saveData.currentClass) || CLASSES[0];
        
        const artDmg = (saveData.artifacts.cube || 0) * 0.1;
        const artSpd = (saveData.artifacts.feather || 0) * 0.05;
        const artCd = (saveData.artifacts.chip || 0) * 0.05;
        
        const shopDmg = saveData.upgrades.damage * 0.1;
        const shopHp = saveData.upgrades.health * 10;
        const shopSpd = saveData.upgrades.speed * 0.05;
        const shopCd = (saveData.upgrades.cooldown || 0) * 0.05;
        const shopCrit = (saveData.upgrades.crit || 0) * 0.05;
        const shopRegen = (saveData.upgrades.regen || 0) * 1;
        const shopRevive = (saveData.upgrades.revive || 0);

        const equipDmg = saveData.equipment.weapon * 0.2; 
        const equipHp = saveData.equipment.armor * 20;    
        const equipSpd = saveData.equipment.boots * 0.05; 
        const equipCd = saveData.equipment.boots * 0.02;  

        this.maxHp = 100 + job.stats.hp + shopHp + equipHp;
        this.hp = this.maxHp;
        this.speed = (3 + job.stats.spd + shopSpd + artSpd + equipSpd);
        this.dmgMult = 1 + job.stats.dmg + shopDmg + artDmg + equipDmg;
        this.cdReduc = Math.min(0.6, job.stats.cd + artCd + equipCd + shopCd); 
        this.critChance = shopCrit;
        this.regenRate = shopRegen;
        this.revives = shopRevive;

        this.size = 20;
        this.invuln = 0;
        this.dashCd = 0; this.dashTime = 0; this.dashVec = {x:0, y:0};
        this.skin = saveData.currentSkin;
    }

    update() {
        // Regen
        if (this.regenRate > 0 && state.time % 180 === 0 && this.hp < this.maxHp) {
            this.hp = Math.min(this.hp + this.regenRate, this.maxHp);
            createPopup('+', this.x, this.y - 20, '#0f0');
        }

        if (this.dashTime > 0) {
            this.x += this.dashVec.x * 15; this.y += this.dashVec.y * 15;
            this.dashTime--;
            if(this.dashTime % 3 === 0) state.particles.push(new Particle(this.x, this.y, '#00ffcc', 10, 10));
        } else {
            let dx = 0, dy = 0;
            
            // Joystick
            if (state.joystick.active) { 
                dx += state.joystick.dx; 
                dy += state.joystick.dy; 
            }
            
            // WASD / Arrows
            if (state.keys.w) dy -= 1; 
            if (state.keys.s) dy += 1;
            if (state.keys.a) dx -= 1; 
            if (state.keys.d) dx += 1;

            // Normalize
            if (dx !== 0 || dy !== 0) { 
                const len = Math.sqrt(dx*dx + dy*dy); 
                if(len > 1) { dx /= len; dy /= len; }
            }
            
            if (dx !== 0 || dy !== 0) { this.x += dx * this.speed; this.y += dy * this.speed; }
        }
        if (this.dashCd > 0) this.dashCd--;
        if (this.invuln > 0) this.invuln--;
    }
    
    dash() {
        if (this.dashCd > 0) return;
        let dx = 0, dy = 0;
        if (state.joystick.active) { dx = state.joystick.dx; dy = state.joystick.dy; } 
        else if (state.keys.w || state.keys.a || state.keys.s || state.keys.d) {
            if (state.keys.w) dy -= 1; if (state.keys.s) dy += 1;
            if (state.keys.a) dx -= 1; if (state.keys.d) dx += 1;
            const len = Math.sqrt(dx*dx + dy*dy); dx /= len; dy /= len;
        } else dx = 1;

        this.dashVec = {x: dx, y: dy};
        this.dashTime = 10; this.dashCd = Math.floor(120 * (1 - this.cdReduc));
        createExplosion(this.x, this.y, '#ffffff', 5);
    }

    takeDamage(amt: number) {
        if (this.dashTime > 0 || this.invuln > 0) return;
        this.hp -= amt;
        this.invuln = 30;
        const thorns = saveData.artifacts.thorn || 0;
        if (thorns > 0) {
            state.enemies.forEach((e:any) => {
                if(Math.hypot(e.x - this.x, e.y - this.y) < 100) e.takeDamage(amt * thorns * 0.5);
            });
        }
        createExplosion(this.x, this.y, '#ff0000', 5);
        
        if (this.hp <= 0) {
            if (this.revives > 0) {
                this.revives--;
                this.hp = this.maxHp * 0.5;
                this.invuln = 120;
                createExplosion(this.x, this.y, '#fff', 50);
                createPopup("REVIVE!", this.x, this.y, '#fff');
                state.enemies.forEach((e:any) => {
                    const dx = e.x - this.x, dy = e.y - this.y;
                    e.pushX = dx * 2; e.pushY = dy * 2;
                });
            } else {
                endGame();
            }
        }
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.translate(this.x, this.y);
        if(this.dashCd > 0) {
            ctx.beginPath(); ctx.arc(0, 0, this.size + 5, 0, (Math.PI * 2) * (1 - this.dashCd/(120*(1-this.cdReduc))));
            ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 2; ctx.stroke();
        }
        let color = '#00ffcc';
        if (state.weapons.blaster.evolved) color = '#ff0099';
        if (this.invuln > 0 && Math.floor(Date.now()/50)%2===0) color = '#fff';
        ctx.fillStyle = color; ctx.shadowBlur = 20; ctx.shadowColor = color;

        if (this.skin === 'neko') {
            ctx.beginPath(); ctx.moveTo(-15, -10); ctx.lineTo(-22, -25); ctx.lineTo(-5, -18); ctx.fill();
            ctx.beginPath(); ctx.moveTo(15, -10); ctx.lineTo(22, -25); ctx.lineTo(5, -18); ctx.fill();
            ctx.beginPath(); ctx.arc(0, 0, this.size, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(-7, -2, 4, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(7, -2, 4, 0, Math.PI*2); ctx.fill();
        } else if (this.skin === 'bot') {
            ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(0, -30); ctx.stroke();
            ctx.beginPath(); ctx.arc(0, -33, 3, 0, Math.PI*2); ctx.fill();
            ctx.fillRect(-this.size, -this.size, this.size*2, this.size*2);
            ctx.fillStyle = '#000'; ctx.fillRect(-15, -5, 30, 8);
        } else if (this.skin === 'star') {
            ctx.save(); ctx.rotate(Date.now() / 200); ctx.beginPath();
            for(let i=0; i<5; i++) {
                ctx.lineTo(Math.cos((18+i*72)/180*Math.PI)*25, -Math.sin((18+i*72)/180*Math.PI)*25);
                ctx.lineTo(Math.cos((54+i*72)/180*Math.PI)*12, -Math.sin((54+i*72)/180*Math.PI)*12);
            }
            ctx.closePath(); ctx.fill(); ctx.restore();
            ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(-5, -2, 3, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(5, -2, 3, 0, Math.PI*2); ctx.fill();
        } else if (this.skin === 'demon') {
             ctx.beginPath(); ctx.moveTo(-10, -15); ctx.lineTo(-20, -35); ctx.lineTo(-5, -20); ctx.fill();
             ctx.beginPath(); ctx.moveTo(10, -15); ctx.lineTo(20, -35); ctx.lineTo(5, -20); ctx.fill();
             ctx.beginPath(); ctx.arc(0, 0, this.size, 0, Math.PI * 2); ctx.fill();
             ctx.fillStyle = '#000'; ctx.beginPath(); ctx.moveTo(-10,-5); ctx.lineTo(-2,0); ctx.lineTo(-10,5); ctx.fill(); ctx.beginPath(); ctx.moveTo(10,-5); ctx.lineTo(2,0); ctx.lineTo(10,5); ctx.fill();
        } else if (this.skin === 'alien') {
             ctx.beginPath(); ctx.ellipse(0, -5, this.size, this.size*1.2, 0, 0, Math.PI*2); ctx.fill();
             ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(-8, -5, 5, 8, 0.2, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.ellipse(8, -5, 5, 8, -0.2, 0, Math.PI*2); ctx.fill();
        } else {
            ctx.beginPath(); ctx.arc(0, 0, this.size, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.arc(-6, -4, 4, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(6, -4, 4, 0, Math.PI*2); ctx.fill();
        }
        ctx.shadowBlur = 0; ctx.restore();
    }
}

class Enemy {
    type: string; x: number; y: number; pushX: number; pushY: number; frozen: number; hp: number; maxHp: number; speed: number; size: number; color: string; dmg: number;
    constructor(type: string, x: number, y: number) {
        this.type = type; this.x = x; this.y = y; this.pushX = 0; this.pushY = 0; this.frozen = 0;
        const scaler = 1 + (state.time / 180);
        if (type === 'SQUARE') { this.hp = 10*scaler; this.speed = 1.5; this.size = 15; this.color = '#ff3333'; this.dmg = 10; }
        else if (type === 'TRIANGLE') { this.hp = 5*scaler; this.speed = 2.5; this.size = 12; this.color = '#ffcc00'; this.dmg = 15; }
        else if (type === 'PENTAGON') { this.hp = 20*scaler; this.speed = 1.0; this.size = 20; this.color = '#33ff33'; this.dmg = 20; }
        else if (type === 'RHOMBUS') { this.hp = 15*scaler; this.speed = 4.0; this.size = 14; this.color = '#00ccff'; this.dmg = 15; }
        else if (type === 'OCTAGON') { this.hp = 80*scaler; this.speed = 0.8; this.size = 30; this.color = '#9900ff'; this.dmg = 30; }
        else if (type === 'SWARM') { this.hp = 2*scaler; this.speed = 3.0; this.size = 8; this.color = '#bc13fe'; this.dmg = 5; }
        else { // Default
            this.hp = 10; this.speed = 1; this.size = 10; this.color = '#fff'; this.dmg = 5;
        }
        if (saveData.artifacts.watch) this.speed *= 0.9;
        this.maxHp = this.hp;
    }
    update(player: Player) {
        if(this.frozen > 0) { this.frozen--; return; }
        this.x += this.pushX; this.y += this.pushY; this.pushX *= 0.9; this.pushY *= 0.9;
        const dx = player.x - this.x, dy = player.y - this.y, dist = Math.sqrt(dx*dx + dy*dy);
        if (dist > 0) { this.x += (dx / dist) * this.speed; this.y += (dy / dist) * this.speed; }
        if (dist < this.size + player.size) { player.takeDamage(this.dmg); this.pushX = -(dx/dist)*10; this.pushY = -(dy/dist)*10; }
    }
    takeDamage(amt: number) {
        if(saveData.artifacts.axe) { const hpPct = state.player.hp / state.player.maxHp; if(hpPct < 0.5) amt *= 1.5; if(hpPct < 0.2) amt *= 2.0; }
        
        // Crit
        let isCrit = false;
        if (Math.random() < state.player.critChance) {
            amt *= 2;
            isCrit = true;
        }

        amt *= state.player.dmgMult; 
        this.hp -= amt; 
        
        createPopup(Math.round(amt).toString() + (isCrit?'!':''), this.x, this.y - 10, isCrit ? '#ff0000' : (amt > 20 ? '#ff0' : '#fff'));
        
        if (this.hp <= 0) { this.die(); return true; } return false;
    }
    die() { 
        createExplosion(this.x, this.y, this.color, 8); 
        if(saveData.artifacts.fang && Math.random() < 0.1) { state.player.hp = Math.min(state.player.hp + 1, state.player.maxHp); createPopup("+1", state.player.x, state.player.y, '#0f0'); }
        const rand = Math.random();
        if (rand < 0.005) state.items.push(new Item(this.x, this.y, 0, 'BOMB'));
        else if (rand < 0.01) state.items.push(new Item(this.x, this.y, 0, 'MAGNET'));
        else if (rand < 0.02) state.items.push(new Item(this.x, this.y, 0, 'HEAL'));
        else state.items.push(new Item(this.x, this.y, 2, 'XP')); 
        state.kills++;
        saveData.stats.totalKills++;
    }
    draw(ctx: CanvasRenderingContext2D) {
        ctx.fillStyle = this.color; ctx.shadowBlur = 10; ctx.shadowColor = this.color; ctx.beginPath();
        if (this.type === 'SQUARE') ctx.rect(this.x - this.size, this.y - this.size, this.size*2, this.size*2);
        else if (this.type === 'TRIANGLE') { ctx.moveTo(this.x, this.y - this.size); ctx.lineTo(this.x + this.size, this.y + this.size); ctx.lineTo(this.x - this.size, this.y + this.size); }
        else ctx.arc(this.x, this.y, this.size, 0, Math.PI*2);
        ctx.fill(); ctx.shadowBlur = 0;
    }
}

class Boss extends Enemy {
    constructor(x: number, y: number) { super('OCTAGON', x, y); this.hp = 5000 * (1 + state.time/300); this.maxHp = this.hp; this.size = 60; this.speed = 1.2; this.color = '#bc13fe'; }
    die() { createExplosion(this.x, this.y, this.color, 50); for(let i=0; i<20; i++) { let it = new Item(this.x + (Math.random()-0.5)*50, this.y + (Math.random()-0.5)*50, 50, 'XP'); it.isCoin = true; it.val = 100; state.items.push(it); } state.boss = null; }
}

// --- External Control Variables ---
let setShowUpgradeScreen: (v: boolean) => void;
let setShowGameOverScreen: (v: boolean) => void;
let setShowStartScreen: (v: boolean) => void;
let setBossHudActive: (v: boolean) => void;
let setUpgradeCards: (cards: React.ReactNode[]) => void;
let setGachaResult: (res: {visible: boolean, icon: string, name: string, desc: string}) => void;
let forceUpdateHUD: () => void;

// --- Game Logic Functions ---

function spawnEnemy() {
    const angle = Math.random() * Math.PI * 2, dist = 800 / 0.75, x = state.player.x + Math.cos(angle) * dist, y = state.player.y + Math.sin(angle) * dist;
    let type = 'SQUARE'; const t = state.time / 60;
    if (t > 180 && Math.random() < 0.1) type = 'OCTAGON'; else if (t > 120 && Math.random() < 0.2) type = 'RHOMBUS'; else if (t > 60 && Math.random() < 0.3) type = 'PENTAGON'; else if (t > 30 && Math.random() < 0.4) type = 'TRIANGLE';
    if (t > 90 && Math.random() < 0.05) for(let i=0; i<10; i++) state.enemies.push(new Enemy('SWARM', x + Math.random()*50, y + Math.random()*50)); else state.enemies.push(new Enemy(type, x, y));
}
function spawnBoss() { const angle = Math.random() * Math.PI * 2, dist = 600, x = state.player.x + Math.cos(angle) * dist, y = state.player.y + Math.sin(angle) * dist; state.boss = new Boss(x, y); state.enemies.push(state.boss); setBossHudActive(true); }
function removeEnemy(e: any) { const idx = state.enemies.indexOf(e); if (idx > -1) state.enemies.splice(idx, 1); if (e instanceof Boss) { state.boss = null; setBossHudActive(false); } }
function addXp(amt: number) { state.xp += amt; if (state.xp >= state.nextLevelXp) { state.xp -= state.nextLevelXp; state.level++; state.nextLevelXp = Math.floor(state.nextLevelXp * 1.2); showUpgradeScreen(); } }

function fireTesla(target: any, bounces: number, dmg: number) {
    let curr = target, visited = [target];
    for(let i=0; i<bounces; i++) {
        if(curr.takeDamage(dmg)) removeEnemy(curr);
        let next = null, minD = 150;
        for(const e of state.enemies) { if (!visited.includes(e)) { const d = Math.hypot(e.x - curr.x, e.y - curr.y); if(d < minD) { minD = d; next = e; } } }
        if(next) { createLightning(curr.x, curr.y, next.x, next.y); curr = next; visited.push(next); } else break;
    }
}
function createLightning(x1: number, y1: number, x2: number, y2: number) { const d = Math.hypot(x2-x1, y2-y1), steps = d/10; for(let i=0; i<steps; i++) state.particles.push(new Particle(x1+(x2-x1)*(i/steps), y1+(y2-y1)*(i/steps), '#88ccff', 0, 5)); }

function spawnGravityWell(x: number, y: number, level: number) { state.gravityWells.push({x, y, life: 180, range: 150+level*20, dmg: level}); }

function updateWeapons() {
    const p = state.player, w = state.weapons; let cdReduc = 1 - p.cdReduc;
    if (w.blaster.cd <= 0) {
        let closest = null, minDist = w.blaster.evolved ? 600 : 400;
        for (const e of state.enemies) { const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < minDist) { minDist = d; closest = e; } }
        if (closest) {
            const angle = Math.atan2(closest.y - p.y, closest.x - p.x);
            if (w.blaster.evolved) { state.projectiles.push(new Projectile(p.x, p.y, Math.cos(angle)*15, Math.sin(angle)*15, 50, '#ff0055', 50, 6, true)); w.blaster.cd = 5; }
            else { state.projectiles.push(new Projectile(p.x, p.y, Math.cos(angle)*10, Math.sin(angle)*10, 30+(w.blaster.level*5), '#ffff00', 40, 4, false)); w.blaster.cd = Math.max(10, (40-(w.blaster.level*4))*cdReduc); }
        }
    } else w.blaster.cd--;
    if (w.orbit.level > 0) {
        w.orbit.angle += 0.05; const count = w.orbit.level + (saveData.artifacts.cube ? 1 : 0);
        for(let i=0; i<count; i++) {
            const theta = w.orbit.angle + (Math.PI*2*i/count); const ox = p.x + Math.cos(theta)*70, oy = p.y + Math.sin(theta)*70;
            state.particles.push(new Particle(ox, oy, '#33ccff', 1, 5));
            for(const e of state.enemies) if(Math.hypot(e.x - ox, e.y - oy) < 15 && e.takeDamage(15)) removeEnemy(e);
        }
    }
    if (w.field.level > 0) {
        if (w.field.cd <= 0) {
            createExplosion(p.x, p.y, 'rgba(0,255,100,0.2)', 5);
            for(const e of state.enemies) if(Math.hypot(e.x - p.x, e.y - p.y) < w.field.radius + (w.field.level*10) && e.takeDamage(5+w.field.level)) removeEnemy(e);
            w.field.cd = 30 * cdReduc;
        } else w.field.cd--;
    }
    if (w.tesla.level > 0) { if (w.tesla.cd <= 0) { let target = null; for(const e of state.enemies) if(Math.hypot(e.x - p.x, e.y - p.y) < 250) { target = e; break; } if(target) { fireTesla(target, 3+w.tesla.level, 20+w.tesla.level*5); w.tesla.cd = (120-(w.tesla.level*5)) * cdReduc; } } else w.tesla.cd--; }
    if (w.missile.level > 0) { if (w.missile.cd <= 0) { state.projectiles.push(new Projectile(p.x, p.y, (Math.random()-0.5)*5, (Math.random()-0.5)*5, 40+w.missile.level*10, '#ffaa00', 150, 8, false)); w.missile.cd = (80 - w.missile.level*5) * cdReduc; } else w.missile.cd--; }
    if (w.gravity.level > 0) { if(w.gravity.cd <= 0) { spawnGravityWell(p.x, p.y, w.gravity.level); w.gravity.cd = (300 - w.gravity.level*10) * cdReduc; } else w.gravity.cd--; }
    if (!state.ult.ready) { state.ult.cd++; if (state.ult.cd >= state.ult.maxCd) { state.ult.ready = true; if(forceUpdateHUD) forceUpdateHUD(); } }
}

function updateGravityWells() {
    for(let i=state.gravityWells.length-1; i>=0; i--) {
        const g = state.gravityWells[i]; g.life--;
        for(const e of state.enemies) { const dx = g.x - e.x, dy = g.y - e.y, d = Math.hypot(dx, dy); if(d < g.range && d > 10) { e.x += (dx/d)*2; e.y += (dy/d)*2; if(g.life%10===0 && e.takeDamage(g.dmg)) removeEnemy(e); } }
        if(g.life%5===0) state.particles.push(new Particle(g.x, g.y, '#6600cc', 2, 10)); if(g.life <= 0) state.gravityWells.splice(i, 1);
    }
}

function endGame() {
    state.running = false;
    setShowGameOverScreen(true);
    saveData.coins += state.coins;
    saveData.stats.totalTime += state.time;
    save();
}

function showUpgradeScreen() {
    state.paused = true;
    const cards: React.ReactNode[] = [];
    
    if (state.weapons.blaster.level === 5 && !state.weapons.blaster.evolved) {
        cards.push(
            <div key="evolution" className="card evolution" onClick={() => selectUpgrade('evolution')}>
                <div className="card-icon">👹</div>
                <div className="card-title">엑스터미네이터</div>
                <div className="card-desc">블래스터 진화: 고출력 관통 레이저 난사</div>
                <div className="card-type">EVOLUTION</div>
            </div>
        );
    } else {
        for(let i=0; i<3; i++) {
            const u = UPGRADES[Math.floor(Math.random() * UPGRADES.length)];
            let lvlInfo = u.type === 'WEAPON' ? `(Lv.${state.weapons[u.id].level})` : '';
            cards.push(
                <div key={i} className="card" onClick={() => selectUpgrade(u.id)}>
                    <div className="card-icon">{u.icon}</div>
                    <div className="card-title">{u.name}</div>
                    <div className="card-desc">{u.desc} {lvlInfo}</div>
                    <div className="card-type">{u.type}</div>
                </div>
            );
        }
    }
    setUpgradeCards(cards);
    setShowUpgradeScreen(true);
}

function selectUpgrade(id: string) {
    if (id === 'heal') state.player.hp = Math.min(state.player.hp + state.player.maxHp * 0.3, state.player.maxHp);
    else if (id === 'evolution') { state.weapons.blaster.evolved = true; createPopup("EVOLUTION!", state.player.x, state.player.y, '#ff0099'); }
    else state.weapons[id].level++;
    setShowUpgradeScreen(false);
    state.paused = false;
}


export default function Game() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const joystickZoneRef = useRef<HTMLDivElement>(null);
    const joystickBaseRef = useRef<HTMLDivElement>(null);
    const joystickKnobRef = useRef<HTMLDivElement>(null);

    // React UI State
    const [showAuth, setShowAuth] = useState(true); // Auth Screen
    const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [authError, setAuthError] = useState('');
    const [currentUser, setCurrentUser] = useState<string | null>(null);

    const [showStart, setShowStart] = useState(false);
    const [showShop, setShowShop] = useState(false);
    const [showArmory, setShowArmory] = useState(false);
    const [showClass, setShowClass] = useState(false);
    const [showWardrobe, setShowWardrobe] = useState(false);
    const [showGacha, setShowGacha] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showAchievement, setShowAchievement] = useState(false);
    const [showPause, setShowPause] = useState(false);
    const [showGameOver, setShowGameOver] = useState(false);
    const [showUpgrade, setShowUpgrade] = useState(false);
    const [isBossActive, setIsBossActive] = useState(false);
    
    const [uiCoins, setUiCoins] = useState(0);
    const [upgradeCardsList, setUpgradeCardsList] = useState<React.ReactNode[]>([]);
    const [gachaRes, setGachaRes] = useState({visible: false, icon: '', name: '', desc: ''});
    const [hudState, setHudState] = useState({ hp: 100, xp: 0, level: 1, kills: 0, coins: 0, time: '00:00', bossHp: 100, ultReady: true });
    const [renderTrigger, setRenderTrigger] = useState(0); // To force re-render lists

    // Bind global setters
    useEffect(() => {
        setShowUpgradeScreen = setShowUpgrade;
        setShowGameOverScreen = setShowGameOver;
        setShowStartScreen = setShowStart;
        setBossHudActive = setIsBossActive;
        setUpgradeCards = setUpgradeCardsList;
        setGachaResult = setGachaRes;
        forceUpdateHUD = () => setHudState(prev => ({...prev}));
        
        // Check active session
        const checkSession = async () => {
            try {
                const { data: { session }, error } = await supabase.auth.getSession();
                if (session) {
                    loginUser(session.user.id);
                }
            } catch(e) {
                console.log("Session check skipped or failed (build mode?)");
            }
        };
        checkSession();

    }, []);

    // --- Authentication Handlers ---
    const handleLogin = async () => {
        if(!email || !password) { setAuthError("이메일과 비밀번호를 입력하세요."); return; }
        setAuthError('');
        
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setAuthError(error.message);
        } else if (data.user) {
            loginUser(data.user.id);
        }
    };

    const handleSignup = async () => {
        if(!email || !password) { setAuthError("이메일과 비밀번호를 입력하세요."); return; }
        setAuthError('');
        
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
        });

        if (error) {
            setAuthError(error.message);
        } else {
            alert("회원가입 성공! 로그인 해주세요.");
            setAuthMode('login');
        }
    };

    const handleGuestLogin = () => {
        loginUser('guest');
    };

    const loginUser = (userId: string) => {
        setCurrentUser(userId);
        loadSaveData(userId);
        setUiCoins(saveData.coins);
        setShowAuth(false);
        setShowStart(true);
        setAuthError('');
        setEmail('');
        setPassword('');
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        setCurrentUser(null);
        setShowSettings(false);
        setShowStart(false);
        setShowAuth(true);
        setAuthMode('login');
    };

    // --- Core Game Loop ---
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

        const loop = () => {
            // If in auth screen, just render background
            if (showAuth) {
                ctx.fillStyle = '#050508'; ctx.fillRect(0, 0, canvas.width, canvas.height);
                requestAnimationFrame(loop);
                return;
            }

            if (!state.running) {
                // Render idle background animation if needed, or just static
                if(!showStart) { 
                   // Only run loop heavily when game is running
                }
                if(state.running === false && showStart === false && showAuth === false && showGameOver === false) {
                   // Edge case transition
                }
            }

            if (state.running && !state.paused) {
                if (state.time % 60 === 0 && state.enemies.length < 300) spawnEnemy();
                if (state.time === BOSS_SPAWN_TIME * 60 && !state.boss) spawnBoss();
                
                if(state.player) state.player.update();
                
                for (let i = state.enemies.length - 1; i >= 0; i--) state.enemies[i].update(state.player);
                
                for (let i = state.projectiles.length - 1; i >= 0; i--) { 
                    const p = state.projectiles[i]; 
                    if(p.update()) { state.projectiles.splice(i, 1); continue; } 
                    let hit = false; 
                    for (const e of state.enemies) { 
                        if (p.pierce && p.hitList.includes(e)) continue; 
                        if (Math.hypot(e.x - p.x, e.y - p.y) < e.size + p.size) { 
                            if(e.takeDamage(p.dmg)) removeEnemy(e); 
                            hit = true; createExplosion(p.x, p.y, p.color, 3); 
                            if (!p.pierce) break; else p.hitList.push(e); 
                        } 
                    } 
                    if (hit && !p.pierce) state.projectiles.splice(i, 1); 
                }
                
                updateWeapons(); 
                updateGravityWells();
                
                for (let i = state.items.length - 1; i >= 0; i--) if (state.items[i].update(state.player)) state.items.splice(i, 1);
                for (let i = state.particles.length - 1; i >= 0; i--) if (state.particles[i].update()) state.particles.splice(i, 1);
                for (let i = state.popups.length - 1; i >= 0; i--) if (state.popups[i].update()) state.popups.splice(i, 1);
                
                state.time++; 
                
                // Update HUD State less frequently
                if (state.time % 15 === 0) {
                     const m = Math.floor(state.time / 3600).toString().padStart(2,'0');
                     const s = Math.floor((state.time % 3600) / 60).toString().padStart(2,'0');
                     setHudState({
                         hp: (state.player.hp / state.player.maxHp) * 100,
                         xp: (state.xp / state.nextLevelXp) * 100,
                         level: state.level,
                         kills: state.kills,
                         coins: state.coins,
                         time: `${m}:${s}`,
                         bossHp: state.boss ? (state.boss.hp / state.boss.maxHp) * 100 : 0,
                         ultReady: state.ult.ready
                     });
                }
            }

            // Render
            ctx.fillStyle = '#050508'; ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            if (state.running || (!showAuth && !showStart)) {
                ctx.save(); 
                const ZOOM = 0.75;
                const cx = canvas.width / 2, cy = canvas.height / 2; 
                ctx.translate(cx, cy); ctx.scale(ZOOM, ZOOM); 
                if(state.player) ctx.translate(-state.player.x, -state.player.y);
                
                // Grid
                if(state.player) {
                    ctx.strokeStyle = 'rgba(50, 0, 100, 0.2)'; ctx.lineWidth = 2; 
                    const gridSize = 100; 
                    const offX = Math.floor(state.player.x / gridSize) * gridSize;
                    const offY = Math.floor(state.player.y / gridSize) * gridSize;
                    ctx.beginPath(); 
                    for (let x = offX - 1000; x < offX + 1000; x += gridSize) { ctx.moveTo(x, offY - 1000); ctx.lineTo(x, offY + 1000); } 
                    for (let y = offY - 1000; y < offY + 1000; y += gridSize) { ctx.moveTo(offX - 1000, y); ctx.lineTo(offX + 1000, y); } 
                    ctx.stroke();
                }

                state.items.forEach((i: any) => i.draw(ctx)); 
                state.gravityWells.forEach((g: any) => { ctx.beginPath(); ctx.arc(g.x, g.y, g.range, 0, Math.PI*2); ctx.strokeStyle='#6600cc'; ctx.stroke(); });
                state.enemies.forEach((e: any) => e.draw(ctx)); 
                if(state.player) state.player.draw(ctx); 
                state.projectiles.forEach((p: any) => p.draw(ctx)); 
                state.particles.forEach((p: any) => p.draw(ctx)); 
                state.popups.forEach((p: any) => p.draw(ctx)); 
                ctx.restore();
            }

            requestAnimationFrame(loop);
        };

        const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
        window.addEventListener('resize', resize);
        resize();
        const raf = requestAnimationFrame(loop);

        return () => {
            window.removeEventListener('resize', resize);
            cancelAnimationFrame(raf);
        }
    }, [showAuth, showStart]);

    // --- Input Handling ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;

            if(e.code === 'Space') {
                state.player?.dash();
            } 
            
            if(e.code === 'KeyW' || e.code === 'ArrowUp') state.keys.w = true; 
            if(e.code === 'KeyA' || e.code === 'ArrowLeft') state.keys.a = true; 
            if(e.code === 'KeyS' || e.code === 'ArrowDown') state.keys.s = true; 
            if(e.code === 'KeyD' || e.code === 'ArrowRight') state.keys.d = true;
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;

            if(e.code === 'KeyW' || e.code === 'ArrowUp') state.keys.w = false; 
            if(e.code === 'KeyA' || e.code === 'ArrowLeft') state.keys.a = false; 
            if(e.code === 'KeyS' || e.code === 'ArrowDown') state.keys.s = false; 
            if(e.code === 'KeyD' || e.code === 'ArrowRight') state.keys.d = false;
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        // Joystick
        const zone = joystickZoneRef.current;
        if(!zone) return;

        const handlePointerDown = (e: PointerEvent) => {
            e.preventDefault(); 
            state.pointer.down = true; state.pointer.id = e.pointerId; 
            state.pointer.x = e.clientX; state.pointer.y = e.clientY;
            state.joystick.active = true; state.joystick.originX = e.clientX; state.joystick.originY = e.clientY;
            
            if(joystickBaseRef.current && joystickKnobRef.current) {
                joystickBaseRef.current.style.display = 'block'; joystickKnobRef.current.style.display = 'block';
                joystickBaseRef.current.style.left = e.clientX + 'px'; joystickBaseRef.current.style.top = e.clientY + 'px';
                joystickKnobRef.current.style.left = e.clientX + 'px'; joystickKnobRef.current.style.top = e.clientY + 'px';
            }
            const now = Date.now(); if (now - state.lastTap < 300) { if (state.player) state.player.dash(); } state.lastTap = now;
        };

        const handlePointerMove = (e: PointerEvent) => {
            if (!state.pointer.down || e.pointerId !== state.pointer.id) return; 
            e.preventDefault();
            const maxDist = 60, dx = e.clientX - state.joystick.originX, dy = e.clientY - state.joystick.originY, dist = Math.sqrt(dx*dx + dy*dy);
            let kx = dx, ky = dy; if (dist > maxDist) { kx = (dx / dist) * maxDist; ky = (dy / dist) * maxDist; }
            
            if(joystickKnobRef.current) {
                joystickKnobRef.current.style.left = (state.joystick.originX + kx) + 'px'; 
                joystickKnobRef.current.style.top = (state.joystick.originY + ky) + 'px';
            }
            state.joystick.dx = kx / maxDist; state.joystick.dy = ky / maxDist;
        };

        const handlePointerUp = (e: PointerEvent) => {
            if (e.pointerId !== state.pointer.id) return; 
            e.preventDefault(); 
            state.pointer.down = false; state.joystick.active = false; state.joystick.dx = 0; state.joystick.dy = 0; 
            if(joystickBaseRef.current && joystickKnobRef.current) {
                joystickBaseRef.current.style.display = 'none'; joystickKnobRef.current.style.display = 'none';
            }
        };

        zone.addEventListener('pointerdown', handlePointerDown);
        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            zone.removeEventListener('pointerdown', handlePointerDown);
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        }
    }, []);

    // --- UI Actions ---
    const startGame = () => {
        setShowStart(false);
        state.running = true; state.paused = false; state.gameOver = false; 
        state.time = 0; state.score = 0; state.kills = 0; state.coins = 0; state.level = 1; state.xp = 0; state.nextLevelXp = 10;
        state.weapons = { blaster: { level: 1, cd: 0, maxCd: 40, evolved: false }, orbit: { level: 0, cd: 0, angle: 0, count: 1 }, field: { level: 0, cd: 0, radius: 80 }, tesla: { level: 0, cd: 0, maxCd: 120 }, missile: { level: 0, cd: 0, maxCd: 80 }, gravity: { level: 0, cd: 0, maxCd: 300 } };
        state.ult = { ready: true, charge: 100, cd: 0, maxCd: 1800 };
        state.player = new Player(); state.enemies = []; state.items = []; state.particles = []; state.projectiles = []; state.popups = []; state.gravityWells = []; state.boss = null;
        state.keys = { w: false, a: false, s: false, d: false, space: false };
        setHudState({ hp: 100, xp: 0, level: 1, kills: 0, coins: 0, time: '00:00', bossHp: 100, ultReady: true });
    };

    const togglePause = () => { if (!state.running) return; state.paused = !state.paused; setShowPause(state.paused); };
    const quitGame = () => { saveData.coins += Math.floor(state.coins); save(); state.running = false; setShowPause(false); setShowStart(true); setUiCoins(saveData.coins); };
    const restartGame = () => { setShowGameOver(false); startGame(); };
    const backToMain = () => { setShowGameOver(false); setShowStart(true); setUiCoins(saveData.coins); };
    
    const useUltimate = () => {
        if (!state.ult.ready) return; 
        state.ult.ready = false; state.ult.cd = 0; 
        createExplosion(state.player.x, state.player.y, '#fff', 100); 
        for(let i=state.enemies.length-1; i>=0; i--) { 
            const e = state.enemies[i]; 
            if (e instanceof Boss) e.takeDamage(1000); 
            else { e.die(); state.enemies.splice(i, 1); } 
        }
        setHudState(prev => ({...prev, ultReady: false}));
    };

    // Sub-menu Handlers
    const openShop = () => { setShowStart(false); setShowShop(true); setUiCoins(saveData.coins); };
    const buyUpgrade = (id: string, cost: number) => { if (saveData.coins >= cost) { saveData.coins -= cost; saveData.upgrades[id]++; save(); setUiCoins(saveData.coins); setRenderTrigger(prev => prev+1); } else alert('코인이 부족합니다!'); };
    
    const openArmory = () => { setShowStart(false); setShowArmory(true); setUiCoins(saveData.coins); };
    const upgradeEquipment = (id: string, cost: number) => { if(saveData.coins >= cost) { saveData.coins -= cost; saveData.equipment[id]++; save(); setUiCoins(saveData.coins); setRenderTrigger(prev => prev+1); } else alert('코인이 부족합니다!'); };
    
    const openClassScreen = () => { setShowStart(false); setShowClass(true); setUiCoins(saveData.coins); };
    const buyClass = (id: string, cost: number) => { if(saveData.coins >= cost) { saveData.coins -= cost; saveData.ownedClasses.push(id); saveData.currentClass = id; save(); setUiCoins(saveData.coins); setRenderTrigger(prev => prev+1); } else alert("코인이 부족합니다!"); };
    const selectClass = (id: string) => { saveData.currentClass = id; save(); setRenderTrigger(prev => prev+1); };

    const openGacha = () => { setShowStart(false); setShowGacha(true); setUiCoins(saveData.coins); setGachaRes({visible:false, icon:'', name:'', desc:''}); };
    const rollGacha = () => {
        if(saveData.coins < GACHA_COST) { alert("코인이 부족합니다!"); return; }
        saveData.coins -= GACHA_COST; setUiCoins(saveData.coins);
        const art = ARTIFACTS[Math.floor(Math.random() * ARTIFACTS.length)];
        if (!saveData.artifacts[art.id]) saveData.artifacts[art.id] = 0; saveData.artifacts[art.id]++; save();
        setGachaRes({visible: true, icon: art.icon, name: art.name, desc: `${art.desc}\n(현재 Lv.${saveData.artifacts[art.id]})`});
    };
    const rollSkinGacha = () => {
        if(saveData.coins < SKIN_COST) { alert("코인이 부족합니다!"); return; }
        saveData.coins -= SKIN_COST; setUiCoins(saveData.coins);
        const skin = SKINS[Math.floor(Math.random() * SKINS.length)];
        if (saveData.ownedSkins.includes(skin.id)) {
            const refund = Math.floor(SKIN_COST * 0.5); saveData.coins += refund; setUiCoins(saveData.coins);
            setGachaRes({visible: true, icon: skin.icon, name: skin.name, desc: `이미 보유중입니다!\n${refund}🪙 환급됨.`});
        } else {
            saveData.ownedSkins.push(skin.id); save();
            setGachaRes({visible: true, icon: skin.icon, name: skin.name, desc: "새로운 스킨 획득!"});
        }
    };

    const openWardrobe = () => { setShowStart(false); setShowWardrobe(true); };
    const selectSkin = (id: string) => { saveData.currentSkin = id; save(); setRenderTrigger(prev => prev+1); };

    const openAchievement = () => { setShowStart(false); setShowAchievement(true); setUiCoins(saveData.coins); };
    const claimAchievement = (id: string, reward: number) => {
        if(saveData.achievements.includes(id)) return;
        saveData.coins += reward; saveData.achievements.push(id); save(); setUiCoins(saveData.coins); setRenderTrigger(prev => prev+1);
    };

    const openSettings = () => { setShowStart(false); setShowSettings(true); };
    const resetData = () => { if(confirm("현재 계정의 데이터를 초기화하시겠습니까?")) { localStorage.removeItem(`ifko_save_v9_${currentUserId}`); window.location.reload(); } };

    return (
        <div id="game-container">
            <div id="credits">제작자: 한국인이라면</div>
            <div className="scanlines"></div>
            <div className="vignette"></div>
            <canvas ref={canvasRef} />

            {/* Joystick UI */}
            <div ref={joystickZoneRef} id="joystick-zone" className={`interactive ${!state.running || state.paused ? 'hidden' : ''}`}></div>
            <div ref={joystickBaseRef} id="joystick-base"></div>
            <div ref={joystickKnobRef} id="joystick-knob"></div>
            {!showStart && !showAuth && <div id="dash-hint">화면 더블 탭 / 스페이스바 : 대시</div>}

            {/* HUD */}
            {!showStart && !showGameOver && !showAuth && (
                <div id="hud" className="ui-layer">
                    <div className="top-row">
                        <div style={{flex:1}}>
                            <div className="stat-box" style={{width: 'fit-content'}}>
                                <div className="stat-text"><span style={{color:'var(--primary)'}}>LV.{hudState.level}</span></div>
                                <div className="stat-text"><span style={{color:'#ccc'}}>💀 {hudState.kills}</span></div>
                                <div className="stat-text"><span style={{color:'var(--gold)'}}>🪙 {hudState.coins}</span></div>
                            </div>
                            <div className="bar-container">
                                <div id="xp-bar" className="bar-fill" style={{width: `${hudState.xp}%`}}></div>
                            </div>
                        </div>
                        <div id="pause-btn" onClick={togglePause}>❚❚</div>
                    </div>
                    
                    <div id="timer">{hudState.time}</div>

                    <div id="boss-hud" className={isBossActive ? 'active' : ''}>
                        <div id="boss-name">⚠️ THE HEXAGON ⚠️</div>
                        <div id="boss-hp-container"><div id="boss-hp-fill" style={{width: `${hudState.bossHp}%`}}></div></div>
                    </div>

                    <div className="bar-container" style={{position:'absolute', bottom: '30px', left: '30px', width:'200px', border: '1px solid rgba(255,50,50,0.3)'}}>
                        <div id="hp-bar" className="bar-fill" style={{width: `${hudState.hp}%`}}></div>
                    </div>

                    <div id="ult-btn" className={`interactive ${!hudState.ultReady ? 'disabled' : ''}`} onClick={useUltimate}>
                        <div id="ult-icon">💣️</div>
                        <div id="ult-label">ULTIMATE</div>
                    </div>
                </div>
            )}

            {/* Auth Screen */}
            {showAuth && (
                <div className="ui-layer menu-screen interactive" style={{display:'flex'}}>
                     <h1 className="screen-title" style={{fontSize:'3.5rem', marginBottom:'10px', color:'var(--primary)'}}>IFKO<br/><span style={{fontSize:'2.5rem', color:'#fff'}}>SURVIVOR</span></h1>
                     <p className="screen-subtitle" style={{marginBottom:'30px'}}>IDENTITY REQUIRED</p>

                     <div style={{maxWidth:'300px', width:'100%'}}>
                        <input type="email" className="auth-input" placeholder="이메일 (Email)" value={email} onChange={e => setEmail(e.target.value)} />
                        <input type="password" className="auth-input" placeholder="비밀번호 (Password)" value={password} onChange={e => setPassword(e.target.value)} />
                        
                        {authError && <p style={{color:'#ff3333', fontSize:'0.9rem', marginTop:'-10px', marginBottom:'15px'}}>{authError}</p>}

                        {authMode === 'login' ? (
                            <>
                                <button className="btn" style={{width:'100%', marginBottom:'10px'}} onClick={handleLogin}>로그인</button>
                                <button className="btn btn-secondary" style={{width:'100%', marginBottom:'20px'}} onClick={() => {setAuthMode('signup'); setAuthError('');}}>회원가입으로 이동</button>
                            </>
                        ) : (
                            <>
                                <button className="btn" style={{width:'100%', marginBottom:'10px'}} onClick={handleSignup}>회원가입</button>
                                <button className="btn btn-secondary" style={{width:'100%', marginBottom:'20px'}} onClick={() => {setAuthMode('login'); setAuthError('');}}>로그인으로 돌아가기</button>
                            </>
                        )}

                        <div style={{borderTop:'1px solid rgba(255,255,255,0.2)', margin:'10px 0'}}></div>
                        <button className="btn btn-secondary" style={{width:'100%'}} onClick={handleGuestLogin}>게스트로 시작</button>
                     </div>
                </div>
            )}

            {/* Start Screen */}
            {showStart && (
                <div className="ui-layer menu-screen interactive" style={{display:'flex'}}>
                    <div style={{position:'absolute', top:'20px', left:'20px', color:'#aaa', fontSize:'0.9rem'}}>
                        USER: <span style={{color:'var(--primary)'}}>{currentUser === 'guest' ? 'Guest' : 'Agent'}</span>
                    </div>

                    <h1 className="screen-title" style={{fontSize:'3.5rem', marginBottom:'10px', color:'var(--primary)'}}>IFKO<br/><span style={{fontSize:'2.5rem', color:'#fff'}}>SURVIVOR</span></h1>
                    <p className="screen-subtitle" style={{marginBottom:'40px'}}>PLANET : IFKO-S512</p>
                    
                    <button className="btn" style={{width:'200px', height:'60px', fontSize:'1.2rem', marginBottom:'30px'}} onClick={startGame}>START</button>
                    
                    <div className="menu-grid">
                        <button className="btn btn-secondary" onClick={openClassScreen}>직업소</button>
                        <button className="btn btn-secondary" onClick={openArmory}>무기고</button>
                        <button className="btn btn-secondary" onClick={openShop}>연구소</button>
                        <button className="btn btn-secondary" onClick={openGacha}>보급소</button>
                        <button className="btn btn-secondary" onClick={openWardrobe}>옷장</button>
                        <button className="btn btn-secondary" onClick={openAchievement}>업적</button>
                        <button className="btn btn-secondary" onClick={openSettings}>설정</button>
                    </div>
                </div>
            )}

            {/* Upgrade Screen */}
            {showUpgrade && (
                <div className="ui-layer interactive menu-screen">
                    <h2 className="screen-title" style={{fontSize:'2rem'}}>SYSTEM UPGRADE</h2>
                    <p className="screen-subtitle">강화 모듈을 선택하십시오</p>
                    <div className="card-container">
                        {upgradeCardsList}
                    </div>
                </div>
            )}

            {/* Pause Screen */}
            {showPause && (
                <div className="ui-layer interactive menu-screen" style={{display:'flex', flexDirection:'column'}}>
                    <h1 className="screen-title">PAUSED</h1>
                    <p className="screen-subtitle">작전 일시 중지</p>
                    <div style={{display:'flex', gap:'15px', flexDirection:'column'}}>
                        <button className="btn" onClick={togglePause}>계속하기</button>
                        <button className="btn btn-secondary" onClick={quitGame}>그만하기</button>
                    </div>
                </div>
            )}

            {/* Shop Screen */}
            {showShop && (
                <div className="ui-layer interactive menu-screen">
                    <div className="currency-display">🪙 {uiCoins}</div>
                    <h1 className="screen-title">LABORATORY</h1>
                    <p className="screen-subtitle">기본 능력치 영구 강화</p>
                    <div className="list-layout">
                        {['damage','health','speed','greed','cooldown','magnet','crit','regen','revive'].map(id => {
                            const lvl = saveData.upgrades[id] || 0;
                            const cost = id === 'revive' ? 5000 * (lvl+1) : SHOP_BASE_COST * (lvl + 1);
                            const nameMap:any = { damage: '기초 공격학', health: '체력 단련', speed: '기동성 훈련', greed: '탐욕의 시선', cooldown: '속사 모듈', magnet: '자기장 확장', crit: '정밀 타격', regen: '나노봇', revive: '심장 충격기' };
                            const descMap:any = { damage: '공격력 +10%', health: '체력 +10', speed: '이속 +5%', greed: '골드 +10%', cooldown: '쿨타임 -5%', magnet: '범위 +30', crit: '치명타 +5%', regen: '초당 회복', revive: '부활 +1회' };
                            return (
                                <div key={id} className="shop-item">
                                    <h3>{nameMap[id]} (Lv.{lvl})</h3>
                                    <p>{descMap[id]}</p>
                                    <button className="btn" style={{fontSize:'0.85rem'}} onClick={() => buyUpgrade(id, cost)}>{cost} 🪙</button>
                                </div>
                            )
                        })}
                    </div>
                    <button className="btn btn-secondary" style={{marginTop:'20px'}} onClick={() => {setShowShop(false); setShowStart(true);}}>뒤로가기</button>
                </div>
            )}

            {/* Armory Screen */}
            {showArmory && (
                <div className="ui-layer interactive menu-screen">
                    <div className="currency-display">🪙 {uiCoins}</div>
                    <h1 className="screen-title">ARMORY</h1>
                    <p className="screen-subtitle">전투 장비 업그레이드</p>
                    <div className="list-layout">
                        {[
                            { id: 'weapon', name: '플라즈마 라이플', desc: '공격력 +20%', icon: '🔫' },
                            { id: 'armor', name: '나노 슈트', desc: '최대 체력 +20', icon: '🛡️' },
                            { id: 'boots', name: '제트 부츠', desc: '이속 +5% / 쿨타임 -2%', icon: '🥾' }
                        ].map(g => {
                            const lvl = saveData.equipment[g.id];
                            const cost = SHOP_BASE_COST * (lvl + 1);
                            return (
                                <div key={g.id} className="shop-item">
                                    <h3 style={{fontSize:'1.5rem'}}>{g.icon}</h3>
                                    <h3>{g.name} (Lv.{lvl})</h3>
                                    <p>{g.desc}</p>
                                    <button className="btn" style={{fontSize:'0.85rem'}} onClick={() => upgradeEquipment(g.id, cost)}>{cost} 🪙</button>
                                </div>
                            )
                        })}
                    </div>
                    <button className="btn btn-secondary" style={{marginTop:'20px'}} onClick={() => {setShowArmory(false); setShowStart(true);}}>뒤로가기</button>
                </div>
            )}

            {/* Class Screen */}
            {showClass && (
                <div className="ui-layer interactive menu-screen">
                    <div className="currency-display">🪙 {uiCoins}</div>
                    <h1 className="screen-title">BARRACKS</h1>
                    <p className="screen-subtitle">전투 직업 선택 및 해금</p>
                    <div className="list-layout">
                        {CLASSES.map(cls => {
                            const owned = saveData.ownedClasses.includes(cls.id);
                            const selected = saveData.currentClass === cls.id;
                            return (
                                <div key={cls.id} className={`shop-item ${selected ? 'selected' : ''}`}>
                                    <h3 style={{fontSize:'1.5rem'}}>{cls.icon}</h3>
                                    <h3>{cls.name}</h3>
                                    <p>{cls.desc}</p>
                                    <div style={{marginBottom:'10px', display:'flex', gap:'5px', flexWrap:'wrap', justifyContent:'center'}}>
                                        {cls.stats.hp!==0 && <span className="class-badge">HP {cls.stats.hp>0?'+':''}{cls.stats.hp}</span>}
                                        {cls.stats.dmg!==0 && <span className="class-badge">DMG {cls.stats.dmg*100}%</span>}
                                        {cls.stats.spd!==0 && <span className="class-badge">SPD {cls.stats.spd}</span>}
                                        {cls.stats.cd!==0 && <span className="class-badge">CDR {cls.stats.cd*100}%</span>}
                                    </div>
                                    {selected && <div className="selected-check">✅</div>}
                                    {selected ? <button className="btn btn-secondary" disabled>장착 중</button> :
                                     owned ? <button className="btn" onClick={() => selectClass(cls.id)}>선택</button> :
                                     <button className="btn btn-accent" onClick={() => buyClass(cls.id, cls.cost)}>{cls.cost} 🪙</button>
                                    }
                                </div>
                            )
                        })}
                    </div>
                    <button className="btn btn-secondary" style={{marginTop:'20px'}} onClick={() => {setShowClass(false); setShowStart(true);}}>뒤로가기</button>
                </div>
            )}

            {/* Gacha Screen */}
            {showGacha && (
                <div className="ui-layer interactive menu-screen">
                    <div className="currency-display">🪙 {uiCoins}</div>
                    <h1 className="screen-title">SUPPLY DEPOT</h1>
                    <p className="screen-subtitle">보급품 투하 요청</p>
                    
                    {gachaRes.visible ? (
                        <div id="gacha-result" style={{display:'flex'}}>
                            <div className="gacha-icon">{gachaRes.icon}</div>
                            <div className="gacha-name">{gachaRes.name}</div>
                            <div className="gacha-desc" style={{whiteSpace:'pre-wrap'}}>{gachaRes.desc}</div>
                            <button className="btn" onClick={() => setGachaRes({...gachaRes, visible: false})}>확인</button>
                        </div>
                    ) : (
                        <div style={{display:'flex', flexDirection:'column', gap:'15px'}}>
                            <button className="btn" onClick={rollGacha}>
                                <div>유물 뽑기</div><div style={{fontSize:'0.8rem', opacity:0.8}}>{GACHA_COST} 🪙</div>
                            </button>
                            <button className="btn btn-accent" onClick={rollSkinGacha}>
                                <div>스킨 뽑기</div><div style={{fontSize:'0.8rem', opacity:0.8}}>{SKIN_COST} 🪙</div>
                            </button>
                        </div>
                    )}
                    <button className="btn btn-secondary" style={{marginTop:'20px'}} onClick={() => {setShowGacha(false); setShowStart(true);}}>뒤로가기</button>
                </div>
            )}

            {/* Wardrobe Screen */}
            {showWardrobe && (
                <div className="ui-layer interactive menu-screen">
                    <h1 className="screen-title">WARDROBE</h1>
                    <p className="screen-subtitle">외형 변경</p>
                    <div className="skin-grid">
                        {SKINS.map(s => {
                            const owned = saveData.ownedSkins.includes(s.id);
                            return (
                                <div key={s.id} className={`skin-item ${saveData.currentSkin === s.id ? 'selected' : ''} ${!owned ? 'locked' : ''}`}
                                     onClick={() => owned && selectSkin(s.id)}>
                                    <div className="skin-preview">{s.icon}</div>
                                    <div className="skin-name">{s.name}</div>
                                    {!owned && <div className="lock-icon">🔒</div>}
                                </div>
                            )
                        })}
                    </div>
                    <button className="btn btn-secondary" style={{marginTop:'20px'}} onClick={() => {setShowWardrobe(false); setShowStart(true);}}>뒤로가기</button>
                </div>
            )}

            {/* Achievement Screen */}
            {showAchievement && (
                <div className="ui-layer interactive menu-screen">
                    <div className="currency-display">🪙 {uiCoins}</div>
                    <h1 className="screen-title">ARCHIVES</h1>
                    <p className="screen-subtitle">임무 기록 및 보상</p>
                    <div className="list-layout">
                        {ACHIEVEMENT_LIST.map(ach => {
                            const claimed = saveData.achievements.includes(ach.id);
                            let progress = 0;
                            let current = 0;
                            if(ach.target.type === 'kills') current = saveData.stats.totalKills || 0;
                            if(ach.target.type === 'time') current = saveData.stats.totalTime || 0;
                            if(ach.target.type === 'coins') current = saveData.stats.totalCoins || 0;
                            progress = Math.min(100, (current / ach.target.val) * 100);
                            
                            return (
                                <div key={ach.id} className={`shop-item ${claimed ? 'selected' : ''}`}>
                                    <h3>{ach.name}</h3>
                                    <p>{ach.desc}</p>
                                    <div className="bar-container" style={{width:'100%', margin:'5px 0'}}>
                                        <div className="bar-fill" style={{width:`${progress}%`, background:'var(--primary)'}}></div>
                                    </div>
                                    {claimed ? <button className="btn btn-secondary" disabled>완료됨</button> :
                                     progress >= 100 ? <button className="btn btn-accent" onClick={() => claimAchievement(ach.id, ach.reward)}>보상: {ach.reward} 🪙</button> :
                                     <div style={{fontSize:'0.8rem', color:'#666'}}>{current} / {ach.target.val}</div>
                                    }
                                </div>
                            )
                        })}
                    </div>
                    <button className="btn btn-secondary" style={{marginTop:'20px'}} onClick={() => {setShowAchievement(false); setShowStart(true);}}>뒤로가기</button>
                </div>
            )}

            {/* Settings Screen */}
            {showSettings && (
                <div className="ui-layer interactive menu-screen">
                    <h1 className="screen-title">SETTINGS</h1>
                    <p className="screen-subtitle">시스템 설정</p>
                    <div style={{display:'flex', flexDirection:'column', gap:'15px'}}>
                        <button className="btn btn-danger" onClick={handleLogout}>로그아웃</button>
                        <button className="btn btn-danger" onClick={resetData}>데이터 초기화</button>
                        <button className="btn btn-secondary" onClick={() => {setShowSettings(false); setShowStart(true);}}>뒤로가기</button>
                    </div>
                </div>
            )}

            {/* Game Over Screen */}
            {showGameOver && (
                <div className="ui-layer menu-screen interactive">
                    <h1 className="screen-title" style={{color:'#ff3333', background:'none'}}>MISSION FAILED</h1>
                    <p style={{fontSize:'1.5rem', marginBottom:'5px'}}>
                        생존 시간: {Math.floor(state.time / 3600).toString().padStart(2,'0')}:{Math.floor((state.time % 3600) / 60).toString().padStart(2,'0')}
                    </p>
                    <p style={{fontSize:'1.2rem', color:'var(--gold)', marginBottom:'30px'}}>획득: {state.coins} 🪙</p>
                    <div style={{display:'flex', gap:'15px'}}>
                        <button className="btn" onClick={restartGame}>재시도</button>
                        <button className="btn btn-secondary" onClick={backToMain}>메인으로</button>
                    </div>
                </div>
            )}
        </div>
    );
}