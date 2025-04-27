// --- Game State ---

// Initialize gameState structure
let gameState = {
    persistent: JSON.parse(JSON.stringify(defaultPersistentState)),
    transient: {
        timers: {
            chopTree: { active: false, elapsed: 0, currentDuration: 0 },
            chopOak: { active: false, elapsed: 0, currentDuration: 0 },
            pickpocketMan: { active: false, elapsed: 0, currentDuration: 0 }
        },
        config: JSON.parse(JSON.stringify(window.defaultTransientConfig || {})),
        internal: {
            gameInterval: null, saveIntervalId: null,
            timeBecameHidden: null, isResetting: false, lastTick: null,
            isActiveSession: true,
            thievingStunEndTime: 0
        }
    }
};
window.gameState = gameState;

console.log("state.js loaded.");