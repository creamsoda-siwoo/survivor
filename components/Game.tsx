
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

// In-Game Level Up Options
const UPGRADES = [
    { id: 'blaster', name: '블래스터 강화', desc: '기본 무기 공격력/속도 증가', type: 'WEAPON', icon: '🔫' },
    { id: 'orbit', name: '위성 포격', desc: '주변을 도는 에너지 볼 추가', type: 'WEAPON', icon: '🪐' },
    { id: 'field', name: '전기장', desc: '주변 적에게 지속 피해', type: 'WEAPON', icon: '⚡' },
    { id: 'tesla', name: '테슬라 코일', desc: '연쇄 번개 공격', type: 'WEAPON', icon: '🌩️' },
    { id: 'missile', name: '유도 미사일', desc: '적을 추적하여 폭발', type: 'WEAPON', icon: '🚀' },
    { id: 'gravity', name: '중력 붕괴', desc: '적을 끌어당기는 블랙홀', type: 'WEAPON', icon: '🌌' },
    { id: 'heal', name: '긴급 수리', desc: '체력 30% 회복', type: 'STAT', icon: '❤️' },
    { id: 'giant', name: '거대화', desc: '모든 투사체/범위 크기 +15%', type: 'STAT', icon: '🐘' },
    { id: 'multishot', name: '멀티샷', desc: '투사체 개수 +1 (일부 무기)', type: 'STAT', icon: '🍒' },
    { id: 'sniper', name: '스나이퍼', desc: '투사체 속도/관통력 증가', type: 'STAT', icon: '🎯' }
];

// --- Game Engine State Container ---
let saveData: any = null;
let currentUserId: string = 'guest'; 

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
    // In-game only stats (reset on death)
    sessionStats: {
        sizeMult: 1,
        projectileCount: 0,
        projectileSpeed: 1
    },
    ult: { ready: true, charge: 100, cd: 0, maxCd: 1800 },
    popups: [],
    gravityWells: [],
    shockwaves: [] // For Ultimate visual effect
};

// --- Helper Functions ---

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
        // Added new lab upgrades: luck, evasion, xp, duration
        upgrades: { damage: 0, health: 0, speed: 0, greed: 0, cooldown: 0, magnet: 0, crit: 0, regen: 0, revive: 0, luck: 0, evasion: 0, xp: 0, duration: 0 },
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
        // Backwards compatibility checks
        if(!saveData.upgrades.cooldown) saveData.upgrades.cooldown = 0;
        if(!saveData.upgrades.luck) saveData.upgrades.luck = 0;
        if(!saveData.upgrades.evasion) saveData.upgrades.evasion = 0;
        if(!saveData.upgrades.xp) saveData.upgrades.xp = 0;
        if(!saveData.upgrades.duration) saveData.upgrades.duration = 0;
        if(!saveData.stats) saveData.stats = { totalKills: 0, totalTime: 0, totalCoins: 0 };
    }
}

function save() {
    if (typeof window !== 'undefined' && saveData) {
        const key = `ifko_save_v9_${currentUserId}`;
        localStorage.setItem(key, JSON.stringify(saveData));
    }
}

// --- Game Classes ---

class PopupText {
    text: string; x: number; y: number; color: string; life: number;
    constructor(text: string, x: number, y: number, color: string) { this.text = text; this.x = x; this.y = y; this.color = color; this.life = 30; }
    update() { this.y -= 1; this.life--; return this.life <= 0; }
    draw(ctx: CanvasRenderingContext2D) { ctx.fillStyle = this.color; ctx.font = "12px 'Exo 2'"; ctx.fillText(this.text, this.x, this.y); }
}

class Particle {
    x: number; y: number; color: string; vx: number; vy: number; life: number; maxLife: number; size: number;
    constructor(x: number, y: number, color: string, speed: number, life: number, size: number = 0) {
        this.x = x; this.y = y; this.color = color; 
        const angle = Math.random() * Math.PI * 2; 
        this.vx = Math.cos(angle) * speed * Math.random(); 
        this.vy = Math.sin(angle) * speed * Math.random(); 
        this.life = life; this.maxLife = life; 
        this.size = size > 0 ? size : Math.random() * 3 + 1;
    }
    update() { this.x += this.vx; this.y += this.vy; this.life--; this.vx *= 0.95; this.vy *= 0.95; return this.life <= 0; }
    draw(ctx: CanvasRenderingContext2D) { ctx.fillStyle = this.color; ctx.globalAlpha = this.life / this.maxLife; ctx.beginPath(); ctx.rect(this.x, this.y, this.size, this.size); ctx.fill(); ctx.globalAlpha = 1; }
}

class Shockwave {
    x: number; y: number; r: number; maxR: number; color: string; alpha: number;
    constructor(x: number, y: number, maxR: number = 1000, color: string = '#fff') {
        this.x = x; this.y = y; this.r = 10; this.maxR = maxR; this.color = color; this.alpha = 1;
    }
    update() {
        this.r += 40; // Faster expansion
        this.alpha -= 0.02;
        return this.alpha <= 0;
    }
    draw(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 15;
        ctx.globalAlpha = this.alpha;
        ctx.stroke();
        ctx.restore();
    }
}

function createPopup(text: string, x: number, y: number, color: string) { state.popups.push(new PopupText(text, x, y, color)); }
function createExplosion(x: number, y: number, color: string, count: number, size: number = 0) { for(let i=0; i<count; i++) state.particles.push(new Particle(x, y, color, 8, 40, size)); }

class Item {
    x: number; y: number; val: number; size: number; type: string; isCoin: boolean; color: string;
    constructor(x: number, y: number, val: number, type = 'XP') {
        this.x = x; this.y = y; this.val = val; this.size = 5; this.type = type; this.isCoin = false;
        const luckMult = 1 + ((saveData.upgrades.luck || 0) * 0.1);
        
        if (type === 'HEAL') { this.color = '#ff0055'; this.size = 8; }
        else if (type === 'MAGNET') { this.color = '#0055ff'; this.size = 8; }
        else if (type === 'BOMB') { this.color = '#ffaa00'; this.size = 8; }
        else { 
            this.isCoin = Math.random() < 0.25; 
            if (this.isCoin) { 
                this.color = '#ffd700'; 
                this.val = Math.floor(50 * (1 + saveData.upgrades.greed * 0.1) * luckMult); 
            } else { 
                this.color = '#33ccff'; 
            } 
        }
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
    constructor(x: number, y: number, vx: number, vy: number, dmg: number, color: string, duration: number, size=4, pierce=false) { 
        this.x = x; this.y = y; this.vx = vx; this.vy = vy; this.dmg = dmg; this.color = color; 
        this.duration = duration * (1 + (saveData.upgrades.duration || 0) * 0.1); 
        this.size = size * state.sessionStats.sizeMult;
        this.pierce = pierce; this.hitList = []; 
    }
    update() { this.x += this.vx; this.y += this.vy; this.duration--; return this.duration <= 0; }
    draw(ctx: CanvasRenderingContext2D) { ctx.fillStyle = this.color; ctx.shadowBlur = 10; ctx.shadowColor = this.color; ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI*2); ctx.fill(); ctx.shadowBlur = 0; }
}

class Player {
    x: number; y: number; maxHp: number; hp: number; speed: number; dmgMult: number; cdReduc: number; size: number; invuln: number; dashCd: number; dashTime: number; dashVec: any; skin: string; critChance: number; regenRate: number; revives: number; evasion: number;
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
        const shopCrit = (saveData.upgrades.crit || 0) * 0.05 + (saveData.upgrades.luck || 0) * 0.02;
        const shopRegen = (saveData.upgrades.regen || 0) * 1;
        const shopRevive = (saveData.upgrades.revive || 0);
        const shopEvasion = (saveData.upgrades.evasion || 0) * 0.05;

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
        this.evasion = shopEvasion;

        this.size = 20;
        this.invuln = 0;
        this.dashCd = 0; this.dashTime = 0; this.dashVec = {x:0, y:0};
        this.skin = saveData.currentSkin;
    }

    update() {
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
            if (state.joystick.active) { dx += state.joystick.dx; dy += state.joystick.dy; }
            
            // Arrow Keys and WASD Support
            if (state.keys.w || state.keys.ArrowUp) dy -= 1; 
            if (state.keys.s || state.keys.ArrowDown) dy += 1;
            if (state.keys.a || state.keys.ArrowLeft) dx -= 1; 
            if (state.keys.d || state.keys.ArrowRight) dx += 1;

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
        else if (state.keys.w || state.keys.a || state.keys.s || state.keys.d || state.keys.ArrowUp || state.keys.ArrowDown || state.keys.ArrowLeft || state.keys.ArrowRight) {
            if (state.keys.w || state.keys.ArrowUp) dy -= 1; 
            if (state.keys.s || state.keys.ArrowDown) dy += 1;
            if (state.keys.a || state.keys.ArrowLeft) dx -= 1; 
            if (state.keys.d || state.keys.ArrowRight) dx += 1;
            const len = Math.sqrt(dx*dx + dy*dy); 
            if (len > 0) { dx /= len; dy /= len; }
        } else dx = 1;

        this.dashVec = {x: dx, y: dy};
        this.dashTime = 10; this.dashCd = Math.floor(120 * (1 - this.cdReduc));
        createExplosion(this.x, this.y, '#ffffff', 5);
    }

    takeDamage(amt: number) {
        if (this.dashTime > 0 || this.invuln > 0) return;
        
        if (Math.random() < this.evasion) {
            createPopup("MISS", this.x, this.y - 30, '#aaa');
            return;
        }

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
        else { this.hp = 10; this.speed = 1; this.size = 10; this.color = '#fff'; this.dmg = 5; }
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
        
        let isCrit = false;
        if (Math.random() < state.player.critChance) { amt *= 2; isCrit = true; }

        amt *= state.player.dmgMult; 
        this.hp -= amt; 
        
        createPopup(Math.round(amt).toString() + (isCrit?'!':''), this.x, this.y - 10, isCrit ? '#ff0000' : (amt > 20 ? '#ff0' : '#fff'));
        
        if (this.hp <= 0) { this.die(); return true; } return false;
    }
    die() { 
        createExplosion(this.x, this.y, this.color, 8); 
        if(saveData.artifacts.fang && Math.random() < 0.1) { state.player.hp = Math.min(state.player.hp + 1, state.player.maxHp); createPopup("+1", state.player.x, state.player.y, '#0f0'); }
        const rand = Math.random();
        const luck = saveData.upgrades.luck || 0;
        if (rand < 0.005 * (1+luck*0.2)) state.items.push(new Item(this.x, this.y, 0, 'BOMB'));
        else if (rand < 0.01 * (1+luck*0.2)) state.items.push(new Item(this.x, this.y, 0, 'MAGNET'));
        else if (rand < 0.02 * (1+luck*0.2)) state.items.push(new Item(this.x, this.y, 0, 'HEAL'));
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
    die() { createExplosion(this.x, this.y, this.color, 50); for(let i=0; i<20; i++) { let it = new Item(this.x + (Math.random()-0.5)*50, this.y + (Math.random()-0.5)*50, 50, 'XP'); it.isCoin = true; it.val = 100; state.items.push(it); } state.boss = null; setBossHudActive(false); }
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
function addXp(amt: number) { 
    const xpBoost = 1 + ((saveData.upgrades.xp || 0) * 0.1);
    state.xp += amt * xpBoost; 
    if (state.xp >= state.nextLevelXp) { state.xp -= state.nextLevelXp; state.level++; state.nextLevelXp = Math.floor(state.nextLevelXp * 1.2); showUpgradeScreen(); } 
}

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

function spawnGravityWell(x: number, y: number, level: number) { state.gravityWells.push({x, y, life: 180, range: 150+level*20 * state.sessionStats.sizeMult, dmg: level}); }

function updateWeapons() {
    const p = state.player, w = state.weapons; let cdReduc = 1 - p.cdReduc;
    const sizeMult = state.sessionStats.sizeMult;
    const projSpeedMult = state.sessionStats.projectileSpeed;
    const extraProj = state.sessionStats.projectileCount;

    if (w.blaster.cd <= 0) {
        let closest = null, minDist = w.blaster.evolved ? 600 : 400;
        for (const e of state.enemies) { const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < minDist) { minDist = d; closest = e; } }
        if (closest) {
            const angle = Math.atan2(closest.y - p.y, closest.x - p.x);
            const shotCount = 1 + extraProj;
            for(let i=0; i<shotCount; i++) {
                const spread = shotCount > 1 ? (i - (shotCount-1)/2) * 0.2 : 0;
                if (w.blaster.evolved) { 
                    state.projectiles.push(new Projectile(p.x, p.y, Math.cos(angle + spread)*15*projSpeedMult, Math.sin(angle + spread)*15*projSpeedMult, 50, '#ff0055', 50, 6, true)); 
                } else { 
                    state.projectiles.push(new Projectile(p.x, p.y, Math.cos(angle + spread)*10*projSpeedMult, Math.sin(angle + spread)*10*projSpeedMult, 30+(w.blaster.level*5), '#ffff00', 40, 4, false)); 
                }
            }
            w.blaster.cd = w.blaster.evolved ? 5 : Math.max(10, (40-(w.blaster.level*4))*cdReduc); 
        }
    } else w.blaster.cd--;

    if (w.orbit.level > 0) {
        w.orbit.angle += 0.05; const count = w.orbit.level + (saveData.artifacts.cube ? 1 : 0) + extraProj;
        for(let i=0; i<count; i++) {
            const theta = w.orbit.angle + (Math.PI*2*i/count); 
            const ox = p.x + Math.cos(theta)*70*sizeMult, oy = p.y + Math.sin(theta)*70*sizeMult;
            state.particles.push(new Particle(ox, oy, '#33ccff', 1, 5, 3 * sizeMult));
            for(const e of state.enemies) if(Math.hypot(e.x - ox, e.y - oy) < 15 * sizeMult && e.takeDamage(15)) removeEnemy(e);
        }
    }

    if (w.field.level > 0) {
        if (w.field.cd <= 0) {
            createExplosion(p.x, p.y, 'rgba(0,255,100,0.2)', 5, 10*sizeMult);
            const range = (w.field.radius + (w.field.level*10)) * sizeMult;
            for(const e of state.enemies) if(Math.hypot(e.x - p.x, e.y - p.y) < range && e.takeDamage(5+w.field.level)) removeEnemy(e);
            w.field.cd = 30 * cdReduc;
        } else w.field.cd--;
    }

    if (w.tesla.level > 0) { if (w.tesla.cd <= 0) { let target = null; for(const e of state.enemies) if(Math.hypot(e.x - p.x, e.y - p.y) < 250) { target = e; break; } if(target) { fireTesla(target, 3+w.tesla.level+extraProj, 20+w.tesla.level*5); w.tesla.cd = (120-(w.tesla.level*5)) * cdReduc; } } else w.tesla.cd--; }
    
    if (w.missile.level > 0) { 
        if (w.missile.cd <= 0) { 
            const count = 1 + Math.floor(extraProj/2);
            for(let i=0; i<count; i++) {
                state.projectiles.push(new Projectile(p.x, p.y, (Math.random()-0.5)*5, (Math.random()-0.5)*5, 40+w.missile.level*10, '#ffaa00', 150, 8, false)); 
            }
            w.missile.cd = (80 - w.missile.level*5) * cdReduc; 
        } else w.missile.cd--; 
    }

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
    setShowUpgradeScreen(true);
    const cards: React.ReactNode[] = [];

    if (state.weapons.blaster.level === 5 && !state.weapons.blaster.evolved) {
        cards.push(
            <div key="evo" className="card evolution" onClick={() => selectUpgrade('evolution')}>
                <div className="card-icon">👹</div>
                <div className="card-title">엑스터미네이터</div>
                <div className="card-desc">블래스터 진화: 고출력 관통 레이저 난사</div>
                <div className="card-type">EVOLUTION</div>
            </div>
        );
    } else {
        for(let i=0; i<3; i++) {
            const u = UPGRADES[Math.floor(Math.random() * UPGRADES.length)];
            let lvlInfo = u.type === 'WEAPON' ? `(Lv.${state.weapons[u.id]?.level || 0})` : '';
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
}

function selectUpgrade(id: string) {
    if (id === 'heal') state.player.hp = Math.min(state.player.hp + state.player.maxHp * 0.3, state.player.maxHp);
    else if (id === 'giant') state.sessionStats.sizeMult += 0.15;
    else if (id === 'multishot') state.sessionStats.projectileCount += 1;
    else if (id === 'sniper') state.sessionStats.projectileSpeed += 0.2;
    else if (id === 'evolution') { state.weapons.blaster.evolved = true; createPopup("EVOLUTION!", state.player.x, state.player.y, '#ff0099'); }
    else if (state.weapons[id]) state.weapons[id].level++;
    
    state.paused = false;
    setShowUpgradeScreen(false);
}

// --- React Component ---

export default function Game() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [showStart, setShowStart] = useState(true);
    const [showGameOver, setShowGameOver] = useState(false);
    const [showUpgrade, setShowUpgrade] = useState(false);
    const [upgradeCardList, setUpgradeCardList] = useState<React.ReactNode[]>([]);
    
    const [hudStats, setHudStats] = useState({ level: 1, kills: 0, coins: 0, time: "00:00", hp: 100, maxHp: 100, xp: 0, nextXp: 10, ultReady: true, ultCd: 0 });
    const [showBossHud, setShowBossHud] = useState(false);
    const [bossHp, setBossHp] = useState(100);
    
    // Menu States
    const [menuState, setMenuState] = useState<'none'|'shop'|'armory'|'wardrobe'|'gacha'|'settings'|'class'>('none');
    const [authMode, setAuthMode] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    // Assign control functions
    useEffect(() => {
        setShowUpgradeScreen = setShowUpgrade;
        setShowGameOverScreen = setShowGameOver;
        setShowStartScreen = setShowStart;
        setUpgradeCards = setUpgradeCardList;
        setBossHudActive = setShowBossHud;
        forceUpdateHUD = () => {}; 
        
        // Load initial data
        loadSaveData('guest');
    }, []);

    // Auth
    const handleLogin = async () => {
        if (!email || !password) return alert('이메일과 비밀번호를 입력하세요.');
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) alert(error.message);
        else {
            alert('로그인 성공!');
            loadSaveData(data.user.id);
            setAuthMode(false);
        }
    };
    const handleSignUp = async () => {
        if (!email || !password) return alert('이메일과 비밀번호를 입력하세요.');
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) alert(error.message);
        else alert('가입 성공! 이메일을 확인해주세요.');
    };

    // HUD Update Loop
    useEffect(() => {
        const interval = setInterval(() => {
            if (state.running && !state.paused && state.player) {
                const m = Math.floor(state.time / 3600);
                const s = Math.floor((state.time % 3600) / 60);
                setHudStats({
                    level: state.level,
                    kills: state.kills,
                    coins: state.coins,
                    time: `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`,
                    hp: state.player.hp,
                    maxHp: state.player.maxHp,
                    xp: state.xp,
                    nextXp: state.nextLevelXp,
                    ultReady: state.ult.ready,
                    ultCd: state.ult.cd / state.ult.maxCd
                });
                if (state.boss) setBossHp((state.boss.hp / state.boss.maxHp) * 100);
            }
        }, 100);
        return () => clearInterval(interval);
    }, []);

    // Game Loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
        window.addEventListener('resize', resize);
        resize();

        let animationFrameId: number;

        const loop = () => {
            if (state.running) {
                if (!state.paused) {
                    if (state.time % 60 === 0 && state.enemies.length < 300) spawnEnemy();
                    if (state.time === BOSS_SPAWN_TIME * 60 && !state.boss) spawnBoss();
                    
                    if (state.player) state.player.update();
                    
                    // Update Enemies
                    for (let i = state.enemies.length - 1; i >= 0; i--) state.enemies[i].update(state.player);
                    
                    // Update Projectiles
                    for (let i = state.projectiles.length - 1; i >= 0; i--) { 
                        const p = state.projectiles[i]; 
                        if(p.update()) { state.projectiles.splice(i, 1); continue; } 
                        let hit = false; 
                        for (const e of state.enemies) { 
                            if (p.pierce && p.hitList.includes(e)) continue; 
                            if (Math.hypot(e.x - p.x, e.y - p.y) < e.size + p.size) { 
                                if(e.takeDamage(p.dmg)) removeEnemy(e); 
                                hit = true; 
                                createExplosion(p.x, p.y, p.color, 3); 
                                if (!p.pierce) break; 
                                else p.hitList.push(e); 
                            } 
                        } 
                        if (hit && !p.pierce) state.projectiles.splice(i, 1); 
                    }
                    
                    updateWeapons(); 
                    updateGravityWells();
                    
                    // Items
                    for (let i = state.items.length - 1; i >= 0; i--) if (state.items[i].update(state.player)) state.items.splice(i, 1);
                    // Particles
                    for (let i = state.particles.length - 1; i >= 0; i--) if (state.particles[i].update()) state.particles.splice(i, 1);
                    // Popups
                    for (let i = state.popups.length - 1; i >= 0; i--) if (state.popups[i].update()) state.popups.splice(i, 1);
                    // Shockwaves
                    for (let i = state.shockwaves.length - 1; i >= 0; i--) if (state.shockwaves[i].update()) state.shockwaves.splice(i, 1);

                    state.time++;
                }

                // Render
                ctx.fillStyle = '#050508'; 
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                if (state.player) {
                    ctx.save(); 
                    const ZOOM = 0.75;
                    const cx = canvas.width / 2;
                    const cy = canvas.height / 2; 
                    
                    // Screen Shake
                    if (state.shockwaves.length > 0) {
                        const shake = Math.random() * 10 - 5;
                        ctx.translate(shake, shake);
                    }

                    ctx.translate(cx, cy); 
                    ctx.scale(ZOOM, ZOOM); 
                    ctx.translate(-state.player.x, -state.player.y);
                    
                    // Grid
                    ctx.strokeStyle = 'rgba(50, 0, 100, 0.2)'; 
                    ctx.lineWidth = 2; 
                    const gridSize = 100; 
                    const offX = Math.floor(state.player.x / gridSize) * gridSize;
                    const offY = Math.floor(state.player.y / gridSize) * gridSize;
                    ctx.beginPath(); 
                    for (let x = offX - 1000; x < offX + 1000; x += gridSize) { ctx.moveTo(x, offY - 1000); ctx.lineTo(x, offY + 1000); } 
                    for (let y = offY - 1000; y < offY + 1000; y += gridSize) { ctx.moveTo(offX - 1000, y); ctx.lineTo(offX + 1000, y); } 
                    ctx.stroke();
                    
                    state.items.forEach((i:any) => i.draw(ctx)); 
                    state.gravityWells.forEach((g:any) => { ctx.beginPath(); ctx.arc(g.x, g.y, g.range, 0, Math.PI*2); ctx.strokeStyle='#6600cc'; ctx.stroke(); });
                    state.enemies.forEach((e:any) => e.draw(ctx)); 
                    state.player.draw(ctx); 
                    state.projectiles.forEach((p:any) => p.draw(ctx)); 
                    state.particles.forEach((p:any) => p.draw(ctx)); 
                    state.popups.forEach((p:any) => p.draw(ctx)); 
                    state.shockwaves.forEach((s:any) => s.draw(ctx));

                    ctx.restore();
                }
            }
            animationFrameId = requestAnimationFrame(loop);
        };
        
        loop();
        return () => cancelAnimationFrame(animationFrameId);
    }, []);

    // Input Handling
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Prevent typing in input fields from triggering game movement
            if ((e.target as HTMLElement).tagName === 'INPUT') return;
            
            if (e.code === 'Space') state.player?.dash();
            if (e.key.toLowerCase() === 'w') state.keys.w = true;
            if (e.key.toLowerCase() === 'a') state.keys.a = true;
            if (e.key.toLowerCase() === 's') state.keys.s = true;
            if (e.key.toLowerCase() === 'd') state.keys.d = true;
            if (e.key === 'ArrowUp') state.keys.ArrowUp = true;
            if (e.key === 'ArrowLeft') state.keys.ArrowLeft = true;
            if (e.key === 'ArrowDown') state.keys.ArrowDown = true;
            if (e.key === 'ArrowRight') state.keys.ArrowRight = true;
            
            // Prevent scrolling with keys
            if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key.toLowerCase() === 'w') state.keys.w = false;
            if (e.key.toLowerCase() === 'a') state.keys.a = false;
            if (e.key.toLowerCase() === 's') state.keys.s = false;
            if (e.key.toLowerCase() === 'd') state.keys.d = false;
            if (e.key === 'ArrowUp') state.keys.ArrowUp = false;
            if (e.key === 'ArrowLeft') state.keys.ArrowLeft = false;
            if (e.key === 'ArrowDown') state.keys.ArrowDown = false;
            if (e.key === 'ArrowRight') state.keys.ArrowRight = false;
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    const startGame = () => {
        setShowStart(false);
        setShowGameOver(false);
        state.running = true; state.paused = false; state.gameOver = false; 
        state.time = 0; state.score = 0; state.kills = 0; state.coins = 0; 
        state.level = 1; state.xp = 0; state.nextLevelXp = 10;
        state.weapons = { 
            blaster: { level: 1, cd: 0, maxCd: 40, evolved: false }, 
            orbit: { level: 0, cd: 0, angle: 0, count: 1 }, 
            field: { level: 0, cd: 0, radius: 80 }, 
            tesla: { level: 0, cd: 0, maxCd: 120 }, 
            missile: { level: 0, cd: 0, maxCd: 80 }, 
            gravity: { level: 0, cd: 0, maxCd: 300 } 
        };
        state.sessionStats = { sizeMult: 1, projectileCount: 0, projectileSpeed: 1 };
        state.ult = { ready: true, charge: 100, cd: 0, maxCd: 1800 };
        state.player = new Player(); state.enemies = []; state.items = []; 
        state.particles = []; state.projectiles = []; state.popups = []; state.shockwaves = [];
        state.boss = null;
        
        // Clear keys on start to prevent stuck movement
        state.keys = { w: false, a: false, s: false, d: false, space: false, ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false };
    };

    const togglePause = () => {
        if (!state.running) return;
        state.paused = !state.paused;
    };

    const useUltimate = () => {
        if (!state.ult.ready) return;
        state.ult.ready = false;
        state.ult.cd = 0;
        
        // Visuals
        createExplosion(state.player.x, state.player.y, '#ffd700', 100, 10); // Gold explosion
        createExplosion(state.player.x, state.player.y, '#ff00ff', 50, 5); // Magenta accents
        state.shockwaves.push(new Shockwave(state.player.x, state.player.y, 1500, '#ffd700'));
        
        // Logic
        for(let i=state.enemies.length-1; i>=0; i--) {
            const e = state.enemies[i];
            if (e instanceof Boss) e.takeDamage(1000);
            else {
                createExplosion(e.x, e.y, e.color, 5);
                state.enemies.splice(i, 1);
                state.kills++;
            }
        }
    };

    // UI Rendering Helpers
    const renderShop = () => {
        const items = [
            { id: 'damage', name: '기초 공격학', desc: '공격력 +10%' },
            { id: 'health', name: '체력 단련', desc: '최대 체력 +10' },
            { id: 'speed', name: '기동성 훈련', desc: '이동속도 +5%' },
            { id: 'greed', name: '탐욕의 시선', desc: '골드 획득량 +10%' },
            { id: 'cooldown', name: '빠른 장전', desc: '쿨타임 -5%' },
            { id: 'crit', name: '치명타 연마', desc: '치명타 확률 +5%' },
            { id: 'luck', name: '행운', desc: '좋은 아이템 확률 증가' },
            { id: 'evasion', name: '회피술', desc: '회피율 +5%' },
            { id: 'xp', name: '학습 능력', desc: '경험치 획득 +10%' },
            { id: 'duration', name: '지속성', desc: '효과 지속시간 +10%' },
            { id: 'regen', name: '자연 치유', desc: '3초마다 체력 1 회복' },
            { id: 'revive', name: '불굴의 의지', desc: '사망 시 1회 부활' }
        ];
        return (
            <div className="list-layout">
                {items.map(item => {
                    const lvl = saveData.upgrades[item.id] || 0;
                    const cost = SHOP_BASE_COST * (lvl + 1) * (item.id === 'revive' ? 10 : 1); // Revive is expensive
                    return (
                        <div key={item.id} className="shop-item">
                            <h3>{item.name} (Lv.{lvl})</h3>
                            <p>{item.desc}</p>
                            <button className="btn" onClick={() => {
                                if (saveData.coins >= cost) {
                                    saveData.coins -= cost;
                                    saveData.upgrades[item.id] = (saveData.upgrades[item.id] || 0) + 1;
                                    save();
                                    setMenuState('shop'); // Force re-render
                                } else alert('코인이 부족합니다!');
                            }}>{cost} 🪙</button>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div id="game-container">
            <div id="credits">제작자: 한국인이라면</div>
            <div className="scanlines"></div>
            <div className="vignette"></div>
            <canvas ref={canvasRef} id="gameCanvas"></canvas>

            {/* Joystick UI */}
            {!showStart && !state.paused && (
                <>
                    <div id="joystick-zone" className="interactive"
                        onPointerDown={(e) => {
                            state.pointer.down = true; state.pointer.id = e.pointerId;
                            state.joystick.active = true; state.joystick.originX = e.clientX; state.joystick.originY = e.clientY;
                            const now = Date.now(); if (now - state.lastTap < 300 && state.player) state.player.dash();
                            state.lastTap = now;
                        }}
                        onPointerMove={(e) => {
                            if (!state.pointer.down || e.pointerId !== state.pointer.id) return;
                            const maxDist = 60, dx = e.clientX - state.joystick.originX, dy = e.clientY - state.joystick.originY;
                            const dist = Math.sqrt(dx*dx + dy*dy);
                            let kx = dx, ky = dy; if (dist > maxDist) { kx = (dx / dist) * maxDist; ky = (dy / dist) * maxDist; }
                            state.joystick.dx = kx / maxDist; state.joystick.dy = ky / maxDist;
                        }}
                        onPointerUp={(e) => {
                            if (e.pointerId !== state.pointer.id) return;
                            state.pointer.down = false; state.joystick.active = false; state.joystick.dx = 0; state.joystick.dy = 0;
                        }}
                    ></div>
                    {state.joystick.active && (
                        <>
                            <div id="joystick-base" style={{display:'block', left:state.joystick.originX, top:state.joystick.originY}}></div>
                            <div id="joystick-knob" style={{display:'block', left:state.joystick.originX + state.joystick.dx*60, top:state.joystick.originY + state.joystick.dy*60}}></div>
                        </>
                    )}
                </>
            )}

            {/* HUD */}
            {!showStart && !showUpgrade && !showGameOver && (
                <div id="hud" className="ui-layer">
                    <div className="top-row" style={{display:'flex', flexDirection:'column', width:'100%', alignItems:'center'}}>
                        
                        {/* Top Stats Bar */}
                        <div style={{display:'flex', width:'100%', justifyContent:'space-between', alignItems:'flex-start'}}>
                            <div className="stat-box">
                                <div className="stat-text"><span style={{color:'var(--primary)'}}>LV.{hudStats.level}</span></div>
                                <div className="stat-text"><span style={{color:'#ccc'}}>💀 {hudStats.kills}</span></div>
                                <div className="stat-text"><span style={{color:'var(--gold)'}}>🪙 {hudStats.coins}</span></div>
                            </div>
                            <div id="pause-btn" onClick={togglePause}>❚❚</div>
                        </div>

                        {/* XP Bar */}
                        <div className="bar-container" style={{width:'100%', maxWidth:'600px', marginTop:'5px', height:'8px'}}>
                            <div id="xp-bar" className="bar-fill" style={{width:`${(hudStats.xp/hudStats.nextXp)*100}%`}}></div>
                        </div>

                        {/* HP Bar - Moved to Top Center */}
                        <div className="bar-container" style={{
                            width:'300px', 
                            height:'20px', 
                            marginTop:'5px', 
                            border:'2px solid rgba(255,50,50,0.5)',
                            background: 'rgba(0,0,0,0.8)',
                            position: 'relative'
                        }}>
                            <div id="hp-bar" className="bar-fill" style={{width:`${(hudStats.hp/hudStats.maxHp)*100}%`}}></div>
                            <div style={{
                                position:'absolute', top:0, left:0, width:'100%', height:'100%', 
                                display:'flex', justifyContent:'center', alignItems:'center',
                                fontSize:'0.7rem', fontWeight:'bold', color:'#fff', textShadow:'0 1px 2px #000'
                            }}>
                                {Math.ceil(hudStats.hp)} / {Math.ceil(hudStats.maxHp)}
                            </div>
                        </div>

                        <div id="timer" style={{position:'relative', top:'0', left:'0', transform:'none', marginTop:'5px', fontSize:'1.2rem'}}>{hudStats.time}</div>
                    </div>

                    {/* Boss HUD */}
                    <div id="boss-hud" className={showBossHud ? "active" : ""}>
                        <div id="boss-name">⚠️ THE HEXAGON ⚠️</div>
                        <div id="boss-hp-container"><div id="boss-hp-fill" style={{width:`${bossHp}%`}}></div></div>
                    </div>

                    {/* Ultimate Button */}
                    <div id="ult-btn" 
                        className={`interactive ${hudStats.ultReady ? '' : 'disabled'}`} 
                        onClick={useUltimate}
                        style={{position:'absolute', bottom:'30px', right:'30px'}}
                    >
                        {hudStats.ultReady ? (
                            <>
                                <div id="ult-icon">💣️</div>
                                <div id="ult-label">ULTIMATE</div>
                            </>
                        ) : (
                            <div style={{fontSize:'0.8rem'}}>{Math.floor((1-hudStats.ultCd)*100)}%</div>
                        )}
                    </div>
                </div>
            )}

            {/* Upgrade Screen */}
            {showUpgrade && (
                <div className="ui-layer interactive menu-screen">
                    <h2 className="screen-title" style={{fontSize:'2rem'}}>SYSTEM UPGRADE</h2>
                    <p className="screen-subtitle">강화 모듈을 선택하십시오</p>
                    <div className="card-container">
                        {upgradeCardList}
                    </div>
                </div>
            )}

            {/* Start Screen */}
            {showStart && menuState === 'none' && (
                <div className="ui-layer menu-screen interactive" style={{display:'flex'}}>
                    <h1 className="screen-title" style={{fontSize:'3.5rem', marginBottom:'10px', color:'var(--primary)'}}>
                        IFKO<br/><span style={{fontSize:'2.5rem', color:'#fff'}}>SURVIVOR</span>
                    </h1>
                    <p className="screen-subtitle" style={{marginBottom:'40px'}}>PLANET : IFKO-S512</p>
                    
                    {authMode ? (
                        <div style={{width:'300px', marginBottom:'20px'}}>
                            <input className="auth-input" type="email" placeholder="이메일" value={email} onChange={e=>setEmail(e.target.value)}/>
                            <input className="auth-input" type="password" placeholder="비밀번호" value={password} onChange={e=>setPassword(e.target.value)}/>
                            <div style={{display:'flex', gap:'10px'}}>
                                <button className="btn" onClick={handleLogin}>로그인</button>
                                <button className="btn btn-secondary" onClick={handleSignUp}>회원가입</button>
                            </div>
                            <button className="btn btn-secondary" style={{width:'100%', marginTop:'10px'}} onClick={()=>{setAuthMode(false); loadSaveData('guest');}}>게스트로 시작</button>
                        </div>
                    ) : (
                        <>
                            <button className="btn" style={{width:'200px', height:'60px', fontSize:'1.2rem', marginBottom:'30px'}} onClick={startGame}>
                                MISSION START
                            </button>
                            <div className="menu-grid">
                                <button className="btn btn-secondary" onClick={()=>setMenuState('class')}>직업소</button>
                                <button className="btn btn-secondary" onClick={()=>setMenuState('armory')}>무기고</button>
                                <button className="btn btn-secondary" onClick={()=>setMenuState('shop')}>연구소</button>
                                <button className="btn btn-secondary" onClick={()=>setMenuState('wardrobe')}>옷장</button>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Sub Menus */}
            {menuState === 'shop' && (
                <div className="ui-layer interactive menu-screen">
                    <div className="currency-display">🪙 {saveData.coins}</div>
                    <h1 className="screen-title">LABORATORY</h1>
                    <p className="screen-subtitle">기본 능력치 영구 강화</p>
                    {renderShop()}
                    <button className="btn btn-secondary" style={{marginTop:'20px'}} onClick={()=>setMenuState('none')}>뒤로가기</button>
                </div>
            )}

             {menuState === 'class' && (
                <div className="ui-layer interactive menu-screen">
                     <div className="currency-display">🪙 {saveData.coins}</div>
                    <h1 className="screen-title">BARRACKS</h1>
                    <div className="list-layout">
                        {CLASSES.map(cls => {
                             const owned = saveData.ownedClasses.includes(cls.id);
                             const selected = saveData.currentClass === cls.id;
                             return (
                                 <div key={cls.id} className={`shop-item ${selected ? 'selected' : ''}`}>
                                     <h3 style={{fontSize:'1.5rem'}}>{cls.icon}</h3>
                                     <h3>{cls.name}</h3>
                                     <p>{cls.desc}</p>
                                     {selected ? <button className="btn btn-secondary" disabled>장착 중</button> :
                                      owned ? <button className="btn" onClick={()=>{ saveData.currentClass = cls.id; save(); setMenuState('class'); }}>선택</button> :
                                      <button className="btn btn-accent" onClick={()=>{
                                          if(saveData.coins >= cls.cost) { saveData.coins -= cls.cost; saveData.ownedClasses.push(cls.id); saveData.currentClass = cls.id; save(); setMenuState('class'); }
                                          else alert("코인이 부족합니다!");
                                      }}>{cls.cost} 🪙</button>}
                                 </div>
                             );
                        })}
                    </div>
                    <button className="btn btn-secondary" style={{marginTop:'20px'}} onClick={()=>setMenuState('none')}>뒤로가기</button>
                </div>
            )}

            {/* Game Over Screen */}
            {showGameOver && (
                <div className="ui-layer menu-screen interactive">
                    <h1 className="screen-title" style={{color:'#ff3333', background:'none'}}>MISSION FAILED</h1>
                    <p style={{fontSize:'1.5rem', marginBottom:'5px'}}>생존 시간: {hudStats.time}</p>
                    <p style={{fontSize:'1.2rem', color:'var(--gold)', marginBottom:'30px'}}>획득: {state.coins} 🪙</p>
                    <div style={{display:'flex', gap:'15px'}}>
                        <button className="btn" onClick={startGame}>재시도</button>
                        <button className="btn btn-secondary" onClick={setShowStartScreen}>메인으로</button>
                    </div>
                </div>
            )}
        </div>
    );
}
