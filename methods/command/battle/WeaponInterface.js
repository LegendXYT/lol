const Error = require('../../../handler/errorHandler.js');
const PassiveInterface = require('./PassiveInterface.js');
const requireDir = require('require-dir');
const ranks = [[0.20,"Common","<:common:416520037713838081>"],[0.20,"Uncommon","<:uncommon:416520056269176842>"],[0.20,"Rare","<:rare:416520066629107712>"],[0.20,"Epic","<:epic:416520722987614208>"],[0.14,"Mythical","<:mythic:416520808501084162>"],[0.05,"Legendary","<a:legendary:417955061801680909>"],[0.01,"Fabled","<a:fabled:438857004493307907>"]];

module.exports = class WeaponInterface{

	/* Constructor */
	constructor(cpassives,qualities,noCreate){

		this.init();
		if(this.availablePassives==="all"){
			this.availablePassives=[];
			for(let i in passives) this.availablePassives.push(i);
		}
		if(noCreate) return;

		/* Keep track of quality list length for buff quality purposes */
		this.initialQualityListLength = this.qualityList.length;
		/* Buff qualities are always in the middle */
		if(this.buffList){
			for(let i in this.buffList){
				let buff = buffs[this.buffList[i]];
				this.qualityList = this.qualityList.concat(buff.getQualityList);
			}
		}else{
			this.buffList = [];
		}
		/* Mana will also have a quality (always last in quality array) */
		if(this.manaRange) this.qualityList.push(this.manaRange);

		/* Get random vars if not present */
		if(!cpassives) cpassives = this.randomPassives();
		if(!qualities) qualities = this.randomQualities();

		/* Construct stats */
		let stats = this.toStats(qualities);

		/* Check if it has enough emojis */
		if(this.emojis.length!=7) throw new Error(`[${args.id}] does not have 7 emojis`);

		/* Get the quality of the weapon */
		let avgQuality = 0;
		if(cpassives.length>0){
			let totalQualities = qualities.reduce((a,b)=>a+b,0);
			let qualityCount = qualities.length;
			for(var i=0;i<cpassives.length;i++){
				totalQualities += cpassives[i].qualities.reduce((a,b)=>a+b,0);
				qualityCount += cpassives[i].qualities.length;
			}
			avgQuality = totalQualities/qualityCount;
		}else{
			avgQuality = qualities.reduce((a,b)=>a+b,0)/qualities.length;
		}
		avgQuality = Math.trunc(avgQuality);

		let emoji = this.getEmoji(avgQuality);
		
		/* Determine rank */
		let rank = 0;
		for(var i=0;i<ranks.length;i++){
			rank += ranks[i][0];
			if(avgQuality/100<=rank){
				rank =  ranks[i];
				i = ranks.length;
			}else if(i==ranks.length-1){
				rank = ranks[0];
			}
		}
		rank = {
			name: rank[1],
			emoji: rank[2]
		}

		/* Construct desc */
		let desc = this.statDesc;
		for(var i=0;i<stats.length;i++){
			desc = desc.replace('?',stats[i]);
		}

		this.weaponQuality = qualities.reduce((a,b)=>a+b,0)/qualities.length;
		this.qualities = qualities;
		this.sqlStat = qualities.join(",");
		this.avgQuality = avgQuality;
		this.desc = desc;
		this.stats = stats;
		if(this.manaRange) this.manaCost = stats[stats.length-1];
		else this.manaCost = 0;
		this.passives = cpassives;
		this.rank = rank;
		this.emoji = emoji;
	}

	/* Alters the animal's stats */
	alterStats(stats){
		for(var i=0;i<this.passives.length;i++)
			this.passives[i].alterStats(stats);
	}

	/* Grabs a random passive(s) */
	randomPassives(){
		let randPassives = [];
		for(var i=0;i<this.passiveCount;i++){
			let rand = Math.floor(Math.random()*this.availablePassives.length);
			let passive = this.availablePassives[rand];
			passive = passives[passive];
			if(!passive)
				throw new Error("Could not get passive["+this.availablePassives[rand]+"] for weapon["+this.id+"]");
			randPassives.push(new passive());
		}
		return randPassives;
	}

	/* Inits random qualities */
	randomQualities(){
		var qualities = [];
		for(var i=0;i<this.qualityList.length;i++)
			qualities.push(Math.trunc(Math.random()*101));
		return qualities;
	}

	/* Converts qualities to stats */
	toStats(qualities){
		if(qualities.length != this.qualityList.length)
			throw new Error("Array size does not match in toStats. Weapon id:"+this.id);
		var stats = [];
		for(var i=0;i<qualities.length;i++){
			let quality = qualities[i];
			if(quality>100) quality = 100;
			if(quality<0) quality = 0;
			let min = this.qualityList[i][0];
			let max = this.qualityList[i][1];

			/* rounds to 2 decimal places */
			stats.push(Math.round((min + (max-min)*(quality/100))*100)/100);
		}
		return stats;
	}

	/* Get the corresponding buff classes */
	getBuffs(){
		let buffClasses = [];
		let index = this.initialQualityListLength; 
		if(this.buffList){
			for(let i in this.buffList){
				let buff = buffs[this.buffList[i]];
				let buffQualityLength = buff.getQualityList.length;
				buffClasses.push(new buff(null,this.qualities.slice(index,index+buffQualityLength)));
				index += buffQualityLength;
			}
		}
		return buffClasses;
	}

	/* Actions */
	/* Physical attack */
	attackPhysical(me,team,enemy){
		return WeaponInterface.basicAttack(me,team,enemy);
	}

	/* Weapon attack */
	attackWeapon(me,team,enemy){
		return this.attackPhysical(me,team,enemy);
	}

	/* Get list of alive animals */
	static getAlive(team){
		let alive = [];
		for(var i in team){
			if(team[i].stats.hp[0]>0)
				alive.push(i);
		}
		return alive;
	}

	/* Deals damage to this animal */
	dealDamage(attacker,attackee,damage,type,last=false){
		let totalDamage = 0;
		if(type==WeaponInterface.PHYSICAL)
			totalDamage = damage * (1-WeaponInterface.resToPercent(attackee.stats.pr[0]+attackee.stats.pr[1]));
		else if(type==WeaponInterface.MAGICAL)
			totalDamage = damage * (1-WeaponInterface.resToPercent(attackee.stats.mr[0]+attackee.stats.mr[1]));
		else if(type==WeaponInterface.TRUE)
			totalDamage = damage;
		else
			throw new Error("Invalid attack type");

		if(totalDamage<0) totalDamage = 0;
		totalDamage = [totalDamage,0];

		/* Calculate bonus damages */
		/* Event for attackee */
		for(let i in attackee.buffs)
			attackee.buffs[i].attacked(attackee,attacker,totalDamage,type,last);
		if(attackee.weapon)
			for(let i in attackee.weapon.passives)
				attackee.weapon.passives[i].attacked(attackee,attacker,totalDamage,type,last);
		/* Event for attacker */
		for(let i in attacker.buffs)
			attacker.buffs[i].attack(attacker,attackee,totalDamage,type,last);
		if(attacker.weapon)
			for(let i in attacker.weapon.passives)
				attacker.weapon.passives[i].attack(attacker,attackee,totalDamage,type,last);

		/* After all damage is calculated */
		/* Event for attackee */
		for(let i in attackee.buffs)
			attackee.buffs[i].postAttacked(attackee,attacker,totalDamage,type,last);
		if(attackee.weapon)
			for(let i in attackee.weapon.passives)
				attackee.weapon.passives[i].postAttacked(attackee,attacker,totalDamage,type,last);
		/* Event for attacker */
		for(let i in attacker.buffs)
			attacker.buffs[i].postAttack(attacker,attackee,totalDamage,type,last);
		if(attacker.weapon)
			for(let i in attacker.weapon.passives)
				attacker.weapon.passives[i].postAttack(attacker,attackee,totalDamage,type,last);

		totalDamage = totalDamage.reduce((a,b)=>a+b,0);
		if(totalDamage<0) totalDamage = 0;
		attackee.stats.hp[0] -= totalDamage;
		return totalDamage;
	}

	/* Uses mana */
	useMana(me,cost){
		if(!me) return false;
		if(!cost) cost = this.manaCost;
		me.stats.wp[0] -= cost;
		return true;
	}

	/* heals */
	heal(me,amount){
		/* Full health */
		if(!me||me.stats.hp[0]>=me.stats.hp[1]+me.stats.hp[3])
			return 0;

		me.stats.hp[0] += amount;
		if(me.stats.hp[0]>me.stats.hp[1]+me.stats.hp[3])
			me.stats.hp[0] = me.stats.hp[1]+me.stats.hp[3];
		return amount;
	}

	preTurn(animal,ally,enemy,action){}
	postTurn(animal,ally,enemy,action){}

	/* Basic attack when animal has no weapon */
	static basicAttack(me,team,enemy){
		if(me.stats.hp[0]<=0) return;
		
		/* Grab an enemy that I'm attacking */
		let attacking = WeaponInterface.getAttacking(me,team,enemy);
		if(!attacking) return;

		/* Calculate damage */
		let damage = WeaponInterface.getDamage(me.stats.att);

		/* Deal damage */
		damage = WeaponInterface.inflictDamage(me,attacking,damage,WeaponInterface.PHYSICAL);

		return `${me.nickname?me.nickname:me.animal.name}\`deals ${damage}\`<:att:531616155450998794>\` to \`${attacking.nickname?attacking.nickname:attacking.animal.name}`
	}

	/* Get an enemy to attack */
	static getAttacking(me,team,enemy){
		let alive = WeaponInterface.getAlive(enemy);
		let attacking = enemy[alive[Math.trunc(Math.random()*alive.length)]];
		for(let i in enemy){
			if(enemy[i].stats.hp[0]>0)
				for(let j in enemy[i].buffs)
					attacking = enemy[i].buffs[j].enemyChooseAttack(enemy[i],me,attacking,team,enemy);
		}
		return attacking;
	}

	/* Calculate the damage output (Either mag or att) */
	static getDamage(stat,multiplier=1){
		return Math.round( (multiplier*(stat[0]+stat[1])) + (Math.random()*100-50));
	}

	/* Calculate the damage output for mixed damage */
	static getMixedDamage(stat1,percent1,stat2,percent2){
		return Math.round( ((stat1[0]+stat1[1])*percent1) + ((stat2[0]+stat2[1])*percent2) + (Math.random()*100-50));
	}

	/* Deals damage to an opponent */
	static inflictDamage(attacker,attackee,damage,type,last=false){
		/* If opponent has a weapon, use that instead */
		if(attackee.weapon)
			return attackee.weapon.dealDamage(attacker,attackee,damage,type);

		let totalDamage = 0;
		if(type==WeaponInterface.PHYSICAL)
			totalDamage = damage * (1-WeaponInterface.resToPercent(attackee.stats.pr[0]+attackee.stats.pr[1]));
		else if(type==WeaponInterface.MAGICAL)
			totalDamage = damage * (1-WeaponInterface.resToPercent(attackee.stats.mr[0]+attackee.stats.mr[1]));
		else if(type==WeaponInterface.TRUE)
			totalDamage = damage;
		else
			throw new Error("Invalid attack type");

		if(totalDamage<0) totalDamage = 0;
		totalDamage = [totalDamage,0];

		/* Bonus damage calculation */
		/* Event for attackee */
		for(let i in attackee.buffs)
			attackee.buffs[i].attacked(attackee,attacker,totalDamage,type,last);
		if(attackee.weapon)
			for(let i in attackee.weapon.passives)
				attackee.weapon.passives[i].attacked(attackee,attacker,totalDamage,type,last);
		/* Event for attacker */
		for(let i in attacker.buffs)
			attacker.buffs[i].attack(attacker,attackee,totalDamage,type,last);
		if(attacker.weapon)
			for(let i in attacker.weapon.passives)
				attacker.weapon.passives[i].attack(attacker,attackee,totalDamage,type,last);

		/* After bonus damage calculation */
		/* Event for attackee */
		for(let i in attackee.buffs)
			attackee.buffs[i].postAttacked(attackee,attacker,totalDamage,type,last);
		if(attackee.weapon)
			for(let i in attackee.weapon.passives)
				attackee.weapon.passives[i].postAttacked(attackee,attacker,totalDamage,type,last);
		/* Event for attacker */
		for(let i in attacker.buffs)
			attacker.buffs[i].postAttack(attacker,attackee,totalDamage,type,last);
		if(attacker.weapon)
			for(let i in attacker.weapon.passives)
				attacker.weapon.passives[i].postAttack(attacker,attackee,totalDamage,type,last);

		totalDamage = totalDamage.reduce((a,b)=>a+b,0);
		if(totalDamage<0) totalDamage = 0;
		attackee.stats.hp[0] -= totalDamage;
		return totalDamage;
	}

	/* heals */
	static heal(me,amount){
		if(me.weapon) return me.weapon.heal(me,amount);
		/* Full health */
		if(!me||me.stats.hp[0]>=me.stats.hp[1]+me.stats.hp[3])
			return 0;

		me.stats.hp[0] += amount;
		if(me.stats.hp[0]>me.stats.hp[1])
			me.stats.hp[0] = me.stats.hp[1];
		return amount;
	}

	getEmoji(quality){
		/* If there are multiple quality, get avg */
		if(typeof quality == "string"){
			quality = parseInt(quality.split(','));
			quality = quality.reduce((a,b)=>a+b,0)/quality.length;
		}
		
		quality /= 100;

		/* Get correct rank */
		var count = 0;
		for(var i=0;i<ranks.length;i++){
			count += ranks[i][0];
			if(quality <= count)
				return this.emojis[i];
		}
		return this.emojis[0];

	}

	/* Get lowest hp animal */
	static getLowestHp(team){
		let lowest = undefined;
		for(let i=0;i<team.length;i++)
			if(team[i].stats.hp[0]>0)
				if(!lowest||lowest.stats.hp[0]/(lowest.stats.hp[1]+lowest.stats.hp[3])
						>team[i].stats.hp[0]/(team[i].stats.hp[1]+team[i].stats.hp[3]))
					lowest = team[i];
		return lowest;
	}

	static resToPercent(res){
		res = res/(120+res);
		if(res>0.75) res = .75;
		return res;
	}

	static resToPrettyPercent(res){
		res = WeaponInterface.resToPercent(res);
		return Math.round(res*100)+"%";
	}

	static get allPassives(){return passives}
	static get allBuffs(){return buffs}
	static get PHYSICAL(){return 'p'}
	static get MAGICAL(){return 'm'}
	static get TRUE(){return 't'}
	static get strEmoji(){return '<:att:531616155450998794>'}
	static get magEmoji(){return '<:mag:531616156231139338>'}
	static get hpEmoji(){return '<:hp:531620120410456064>'}
	static get getID(){return new this(null,null,true).id}
	static get disabled(){return new this(null,null,true).disabled}
	static get getName(){return new this(null,null,true).name}
	static get unsellable(){return new this(null,null,true).unsellable}
	static get getDesc(){return new this(null,null,true).basicDesc}
	static get getEmoji(){return new this(null,null,true).defaultEmoji}
}

const passiveDir = requireDir('./passives');
var passives = {};
for(var key in passiveDir){
	let passive = passiveDir[key];
	if(!passive.disabled) passives[passive.getID] = passive;
}
const buffDir = requireDir('./buffs');
var buffs = {};
for(var key in buffDir){
	let buff = buffDir[key];
	if(!buff.disabled) buffs[buff.getID] = buff;
}
