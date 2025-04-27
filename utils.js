// --- Utility Functions ---

// Basic logging wrapper (assuming ui.js logMessage will take over)
function logMessageFallback(message, type = 'normal') {
    console.log(`[${type}] ${message}`);
}

// Format milliseconds into HH:MM:SS
function formatTime(milliseconds) {
    if (milliseconds < 0 || isNaN(milliseconds)) milliseconds = 0;
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Calculate total XP needed to *reach* a given level
function getXpNeededForLevel(level) {
    if (level <= 1) return 0;
    const base = window.gameState?.transient?.config?.xpPerLevelBase ?? 100;
    const mult = window.gameState?.transient?.config?.xpLevelMultiplier ?? 1.1;
    return Math.floor(base * Math.pow(mult, level - 2));
}

// Calculate total cumulative XP needed to *be* at the start of a target level
function getTotalXpForLevel(targetLevel) {
    let totalXp = 0;
    for (let i = 1; i < targetLevel; i++) {
        totalXp += getXpNeededForLevel(i + 1); // XP needed to complete level i
    }
    return totalXp;
}


console.log("utils.js loaded.");