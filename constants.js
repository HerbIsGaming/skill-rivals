// --- START OF FILE constants.js ---

// --- Static Game Data ---
const itemData = {
    // Resources
    'wood': { id: 'wood', name: 'Wood', type: 'resource', stackLimit: 999, icon: 'images/wood.png' }, // Added icon
    'oakLog': { id: 'oakLog', name: 'Oak Logs', type: 'resource', stackLimit: 999, icon: 'images/oak_log.png' }, // Added icon
    // Equipment
    'bronzeAxe': { id: 'bronzeAxe', name: 'Bronze Axe', type: 'equipment', slot: 'axe', description: 'A basic woodcutting axe.', tier: 1, stackLimit: 1, requirements: { skills: { woodcutting: 1 } }, buyPrice: 50, icon: 'images/bronze_axe.png' }, // Added icon
    'steelAxe': { id: 'steelAxe', name: 'Steel Axe', type: 'equipment', slot: 'axe', description: 'A sturdy steel axe.', tier: 2, stackLimit: 1, requirements: { skills: { woodcutting: 10 } }, buyPrice: 250, icon: 'images/steel_axe.png' }, // Added icon

    // Thieving Loot Items
    'copperCoin': { id: 'copperCoin', name: 'Copper Coin', type: 'junk', stackLimit: 100, description: 'A slightly tarnished coin.', sellPrice: 2, icon: 'images/copper_coin.png' }, // Added icon
    'lint': { id: 'lint', name: 'Pocket Lint', type: 'junk', stackLimit: 50, description: 'Just some fluff.', sellPrice: 1, icon: 'images/lint.png' }, // Added icon
    // Placeholder for key from your screenshot (assuming you want to add it)
    'mysteryKey': { id: 'mysteryKey', name: 'Mystery Key', type: 'special', stackLimit: 1, description: 'What does it unlock?', icon: 'images/mystery_key.png' } // Added icon
};
window.itemData = itemData; // Make globally accessible

const MAX_INV_SLOTS = 30;
const MAX_BANK_SLOTS = 100;

const SHOP_STOCK = {
    'bronzeAxe': Infinity,
    'steelAxe': Infinity,
};
window.SHOP_STOCK = SHOP_STOCK; // Make globally accessible

// --- Default Persistent State ---
const defaultPersistentState = {
    skills: { woodcutting: { xp: 0, level: 1 }, thieving: { xp: 0, level: 1 } },
    inventory: new Array(MAX_INV_SLOTS).fill(null),
    equipment: { axe: null },
    bankInventory: new Array(MAX_BANK_SLOTS).fill(null),
    gold: 100,
    bankGold: 0,
    lastSaveTime: null,
    sessionStartTime: { chopTree: null, chopOak: null, pickpocketMan: null },
    settings: { theme: 'dark' }
};

// --- Default Transient Config ---
const defaultTransientConfig = {
    level1ChopTime_Tree: 5000, levelCapChopTime_Tree: 1500, chopTimeVariance_Tree: 500, xpPerLog_Tree: 10,
    level1ChopTime_Oak: 8000, levelCapChopTime_Oak: 2500, chopTimeVariance_Oak: 800, xpPerLog_Oak: 25,
    treeTierReq: 1, treeLevelReq: 1, oakTierReq: 2, oakLevelReq: 10,
    levelScalingCap: 99, xpPerLevelBase: 100, xpLevelMultiplier: 1.1,
    activeXpBonusMultiplier: 1.2, activeWoodBonusChance: 0.1, activeOakBonusChance: 0.05,
    saveInterval: 15000, maxActionDuration: 12 * 60 * 60 * 1000,
    sellPriceRatio: 0.25,
    pickpocketManTime: 4000, pickpocketManVariance: 500, xpPerPickpocketMan: 8, pickpocketManLevelReq: 1, pickpocketManSuccessRate: 0.8, pickpocketManLootTable: ['copperCoin', 'lint'], pickpocketManStunDuration: 3000,
};
window.defaultTransientConfig = defaultTransientConfig; // Make global

console.log("constants.js loaded.");