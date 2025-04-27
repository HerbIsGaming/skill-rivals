// --- Saving, Loading & Offline/Background Progress ---

function resetGameData() {
    try {
        if (typeof logMessage === 'function') { logMessage("Resetting game data and reloading...", "warn"); }
        else { console.warn("Resetting game data and reloading..."); }
        if (window.gameState && window.gameState.transient?.internal) { window.gameState.transient.internal.isResetting = true; }
        localStorage.removeItem('skillRivalsSave');
        console.log("Save data cleared from localStorage.");
        window.location.reload();
    } catch (e) {
        console.error("Error during resetGameData:", e);
        if (typeof logMessage === 'function') { logMessage("Failed to reset save data.", "error"); }
        if (window.gameState && window.gameState.transient?.internal) { window.gameState.transient.internal.isResetting = false; }
    }
}

function saveGame() {
    if (!window.gameState || !window.gameState.transient?.internal || window.gameState.transient.internal.isResetting) { console.log("Save skipped: Game resetting or gameState not ready."); return; }
    try {
        const persistentDataToSave = JSON.parse(JSON.stringify(gameState.persistent));
        persistentDataToSave.lastSaveTime = Date.now();
        const saveData = JSON.stringify(persistentDataToSave);
        localStorage.setItem('skillRivalsSave', saveData);
        // console.log("Game saved at", new Date(persistentDataToSave.lastSaveTime).toLocaleTimeString());
    } catch (e) { console.error("Save failed:", e); if (typeof logMessage === 'function') logMessage("Failed to save game. Storage might be full.", "error"); }
}


function loadGame() {
    console.log("%c--- loadGame() started ---", "color: blue; font-weight: bold;");
    let finalGoldValue = -1;
    try {
        const savedDataString = localStorage.getItem('skillRivalsSave');
        const defaultStateCopy = JSON.parse(JSON.stringify(defaultPersistentState));
        if (!defaultStateCopy) { console.error("LOAD FATAL: Failed to create default state copy!"); return; }

        // Initialize transient state safely
        if (!window.gameState) window.gameState = {}; // Ensure base object exists
        gameState.transient = {
            timers: { chopTree: { active: false, elapsed: 0, currentDuration: 0 }, chopOak: { active: false, elapsed: 0, currentDuration: 0 }, pickpocketMan: { active: false, elapsed: 0, currentDuration: 0 } },
            config: JSON.parse(JSON.stringify(window.defaultTransientConfig || {})), // Use global default config
            internal: { gameInterval: null, saveIntervalId: null, timeBecameHidden: null, isResetting: false, lastTick: null, isActiveSession: true, thievingStunEndTime: 0 }
        };
        console.log("LOAD: Default/Transient state initialized.");

        if (savedDataString) {
            console.log("LOAD: Save data FOUND. Parsing...");
            const loadedState = JSON.parse(savedDataString);
            if (!loadedState) { throw new Error("Parsed save data is null or undefined."); }
            console.log("LOAD: Parsed save data.");

            // Robust Merging...
            loadedState.skills = { ...defaultStateCopy.skills, ...(loadedState.skills || {}) };
            Object.keys(defaultStateCopy.skills).forEach(skillKey => { if (!loadedState.skills[skillKey]) loadedState.skills[skillKey] = defaultStateCopy.skills[skillKey]; });
            if (!Array.isArray(loadedState.inventory) || loadedState.inventory.length !== MAX_INV_SLOTS) { loadedState.inventory = defaultStateCopy.inventory; } else { loadedState.inventory = loadedState.inventory.slice(0, MAX_INV_SLOTS).concat(new Array(MAX_INV_SLOTS - loadedState.inventory.length).fill(null)); }
            if (!Array.isArray(loadedState.bankInventory) || loadedState.bankInventory.length !== MAX_BANK_SLOTS) { loadedState.bankInventory = defaultStateCopy.bankInventory; } else { loadedState.bankInventory = loadedState.bankInventory.slice(0, MAX_BANK_SLOTS).concat(new Array(MAX_BANK_SLOTS - loadedState.bankInventory.length).fill(null)); }
            loadedState.settings = { ...defaultStateCopy.settings, ...(loadedState.settings || {}) };
            loadedState.equipment = { ...defaultStateCopy.equipment, ...(loadedState.equipment || {}) };

            gameState.persistent = { ...defaultStateCopy, ...loadedState }; // Assign merged state
            console.log("LOAD: MERGED save data.");

            const lastSaveTime = gameState.persistent.lastSaveTime;
            if (lastSaveTime && typeof calculateProgress === 'function') { /* Calculate offline progress */ }
            if (typeof logMessage === 'function') logMessage("Game loaded.", "info");

        } else {
            console.log("LOAD: No save data found. Using default state.");
            gameState.persistent = defaultStateCopy; // Use default persistent state
            if (typeof logMessage === 'function') logMessage("No save data found. Starting new game.", "info");
        }

    } catch (e) {
        console.error("LOAD FAILED:", e);
        localStorage.removeItem('skillRivalsSave');
        if (typeof logMessage === 'function') logMessage("Failed to load save data. Starting new game.", "error");
        gameState.persistent = JSON.parse(JSON.stringify(defaultPersistentState));
        gameState.transient = { timers: {}, config: JSON.parse(JSON.stringify(window.defaultTransientConfig || {})), internal: { isActiveSession: true } };
        console.log("LOAD: Resetting to default state due to error.");
    }

    finalGoldValue = window.gameState?.persistent?.gold ?? 'ERROR';
    console.log(`%c--- loadGame() finished. Final persistent gold: ${finalGoldValue} ---`, "color: blue; font-weight: bold;");
} // End loadGame


function calculateProgress(type, timeElapsed) {
    console.log(`Calculating ${type} progress for ${formatTime(timeElapsed)}.`);
    if (!window.gameState || !window.itemData || !window.defaultTransientConfig) { console.error("calculateProgress ERROR: Data missing."); return; }
    let totalCompletions = {}; let totalXpGained = {}; let totalResourcesGained = {}; const config = gameState.transient.config; const initialSkills = JSON.parse(JSON.stringify(gameState.persistent.skills)); let activeAction = null; let sessionStartTime = 0; let latestStartTime = 0;
    for (const action in gameState.persistent.sessionStartTime) { const startTime = gameState.persistent.sessionStartTime[action]; if (startTime && (Date.now() - startTime < config.maxActionDuration) && startTime > latestStartTime) { latestStartTime = startTime; activeAction = action; sessionStartTime = startTime; } }
    if (activeAction) {
        console.log(`Simulating ${type} progress for action: ${activeAction}`); let timeAlreadyElapsedInCycle = 0; if (sessionStartTime > 0 && gameState.persistent.lastSaveTime && gameState.persistent.lastSaveTime > sessionStartTime) { const timeInSessionBeforeSave = gameState.persistent.lastSaveTime - sessionStartTime; let levelWhenSaved = 1; let baseTimeWhenSaved = 0; switch (activeAction) { case 'chopTree': levelWhenSaved = initialSkills.woodcutting?.level || 1; baseTimeWhenSaved = calculateBaseActionTime(levelWhenSaved, config.level1ChopTime_Tree, config.levelCapChopTime_Tree); break; case 'chopOak': levelWhenSaved = initialSkills.woodcutting?.level || 1; baseTimeWhenSaved = calculateBaseActionTime(levelWhenSaved, config.level1ChopTime_Oak, config.levelCapChopTime_Oak); break; case 'pickpocketMan': baseTimeWhenSaved = config.pickpocketManTime; break; default: baseTimeWhenSaved = 5000; break; } const averageActionDurationWhenSaved = Math.max(500, baseTimeWhenSaved); if (averageActionDurationWhenSaved > 0) { timeAlreadyElapsedInCycle = timeInSessionBeforeSave % averageActionDurationWhenSaved; } } const remainingTimeToSimulate = timeElapsed; let simulatedTime = 0; totalCompletions[activeAction] = 0; let inventoryFull = false;
        while (simulatedTime < remainingTimeToSimulate && !inventoryFull) { const canPerform = checkRequirements(getActionRequirements(activeAction)); if (!canPerform) { if (typeof logMessage === 'function') logMessage(`${activeAction} stopped offline: Requirements failed.`, "warn"); break; } let skillName = null; let currentLevel = 1; let baseTime = 0; let xpPer = 0; let resId = null; let lootTable = null; let successRate = 1.0; switch (activeAction) { case 'chopTree': skillName = 'woodcutting'; currentLevel = gameState.persistent.skills[skillName]?.level || 1; baseTime = calculateBaseActionTime(currentLevel, config.level1ChopTime_Tree, config.levelCapChopTime_Tree); xpPer = config.xpPerLog_Tree; resId = 'wood'; break; case 'chopOak': skillName = 'woodcutting'; currentLevel = gameState.persistent.skills[skillName]?.level || 1; baseTime = calculateBaseActionTime(currentLevel, config.level1ChopTime_Oak, config.levelCapChopTime_Oak); xpPer = config.xpPerLog_Oak; resId = 'oakLog'; break; case 'pickpocketMan': skillName = 'thieving'; currentLevel = gameState.persistent.skills[skillName]?.level || 1; baseTime = config.pickpocketManTime; xpPer = config.xpPerPickpocketMan; lootTable = config.pickpocketManLootTable; successRate = config.pickpocketManSuccessRate; break; default: baseTime = 5000; break; } const actionDuration = Math.max(500, baseTime); let timeToNextCompletion = actionDuration - timeAlreadyElapsedInCycle; if (timeToNextCompletion <= 0) timeToNextCompletion = actionDuration; if (simulatedTime + timeToNextCompletion > remainingTimeToSimulate) { break; } simulatedTime += timeToNextCompletion; timeAlreadyElapsedInCycle = 0; let actionSucceededThisCycle = true; let resourceGainedId = null; let quantityGained = 1; if (activeAction === 'pickpocketMan') { actionSucceededThisCycle = Math.random() < successRate; if (actionSucceededThisCycle) { if (lootTable && lootTable.length > 0) { resourceGainedId = lootTable[Math.floor(Math.random() * lootTable.length)]; } else { actionSucceededThisCycle = false; } } } else { resourceGainedId = resId; } let itemAddedThisCycle = false; if (actionSucceededThisCycle && resourceGainedId) { let tempInv = JSON.parse(JSON.stringify(gameState.persistent.inventory)); if (addItemToInventory(resourceGainedId, quantityGained, tempInv, MAX_INV_SLOTS)) { addItemToInventory(resourceGainedId, quantityGained, gameState.persistent.inventory, MAX_INV_SLOTS); totalResourcesGained[resourceGainedId] = (totalResourcesGained[resourceGainedId] || 0) + quantityGained; itemAddedThisCycle = true; } else { inventoryFull = true; if (typeof logMessage === 'function') logMessage(`Inventory full during offline progress for ${activeAction}.`, "warn"); break; } } if (actionSucceededThisCycle && skillName && xpPer > 0 && (resourceGainedId ? itemAddedThisCycle : true)) { gainXp(skillName, xpPer, false); totalXpGained[skillName] = (totalXpGained[skillName] || 0) + xpPer; } }
    } else { console.log(`No active action found for offline progress.`); }
    // Log Summary...
    if (typeof logMessage === 'function') { /* ... Log summary ... */ }
    // Final State Cleanup
    Object.keys(gameState.persistent.sessionStartTime || {}).forEach(key => { gameState.persistent.sessionStartTime[key] = null; });
    Object.values(gameState.transient.timers || {}).forEach(timer => timer.active = false);
    console.log("calculateProgress finished.");
} // End calculateProgress


console.log("saveLoad.js loaded.");