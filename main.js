// --- Main Game Initialization and Loop ---

// --- Dev Functions ---
function devSetSkillLevel(skillId, level) { if (window.gameState && window.gameState.persistent?.skills?.[skillId] && level >= 1 && typeof getTotalXpForLevel === 'function') { const targetXp = getTotalXpForLevel(level); window.gameState.persistent.skills[skillId].xp = targetXp; window.gameState.persistent.skills[skillId].level = level; if (typeof updateAllDisplays === 'function') updateAllDisplays(); if (typeof logMessage === 'function') logMessage(`DEV: Set ${skillId} to Level ${level}`, "debug"); } else { console.error(`DEV Error: Set Level failed for ${skillId} to ${level}`); } }
window.devSetSkillLevel = devSetSkillLevel;
function devGiveItem(itemId, quantity) { if (window.gameState && window.itemData?.[itemId] && quantity >= 1 && typeof addItemToInventory === 'function') { const success = addItemToInventory(itemId, quantity, window.gameState.persistent.inventory, MAX_INV_SLOTS); if (success) { if (typeof logMessage === 'function') logMessage(`DEV: Gave ${quantity}x ${itemData[itemId]?.name || itemId}`, "debug"); if (typeof updateAllDisplays === 'function') updateAllDisplays(); } else { logMessage(`DEV: Failed to give ${quantity}x ${itemData[itemId]?.name || itemId} (Inventory full?)`, "warn"); } } else { console.error(`DEV Error: Give Item failed for ${itemId} (x${quantity})`); } }
window.devGiveItem = devGiveItem;

// --- Game Loop ---
function gameTick() { if (!window.gameState || !window.itemData || !window.gameState.transient?.internal) return; const now = Date.now(); const deltaTime = now - (gameState.transient.internal.lastTick || now); gameState.transient.internal.lastTick = now; let needsSidebarUpdate = false; let activeActionType = null; let feedbackOccurredThisTick = null; let feedbackAction = null; for (const type in gameState.transient.timers) { const timer = gameState.transient.timers[type]; if (timer.active) { needsSidebarUpdate = true; activeActionType = type; timer.elapsed += deltaTime; if (timer.elapsed >= timer.currentDuration) { const completions = Math.floor(timer.elapsed / timer.currentDuration); const remainingElapsed = timer.elapsed - completions * timer.currentDuration; let feedbackResult = null; for (let i = 0; i < completions; i++) { feedbackResult = completeAction(type, false); if (feedbackResult) { feedbackOccurredThisTick = feedbackResult; feedbackAction = type; } if (!timer.active) { activeActionType = null; needsSidebarUpdate = true; break; } } if (timer.active) { timer.elapsed = remainingElapsed; } else { timer.elapsed = 0; activeActionType = null; } } break; } } const currentActionElement = activeActionType ? document.getElementById(`action-${activeActionType}`) : null; if (activeActionType && typeof updateSingleActionState === 'function') { if (currentActionElement) { const feedbackForThisAction = (feedbackAction === activeActionType) ? feedbackOccurredThisTick : null; updateSingleActionState(activeActionType, feedbackForThisAction); } } if (feedbackAction === activeActionType) { feedbackOccurredThisTick = null; feedbackAction = null; } const thievingStunEndTime = gameState.transient.internal.thievingStunEndTime || 0; let stunJustExpired = false; if (thievingStunEndTime > 0) { needsSidebarUpdate = true; if (thievingStunEndTime <= now) { gameState.transient.internal.thievingStunEndTime = 0; stunJustExpired = true; if (typeof startAction === 'function') { startAction('pickpocketMan', true); } if (typeof updateSingleActionState === 'function' && document.getElementById('action-pickpocketMan')) { updateSingleActionState('pickpocketMan'); } logMessage("Stun finished.", "info"); } } if (needsSidebarUpdate || stunJustExpired || feedbackOccurredThisTick) { if (typeof updateSidebarActionDisplay === 'function') { updateSidebarActionDisplay(feedbackOccurredThisTick, feedbackAction); } } feedbackOccurredThisTick = null; feedbackAction = null; }
function startGameLoop() { if (window.gameState && !gameState.transient.internal.gameInterval) { gameState.transient.internal.lastTick = Date.now(); gameState.transient.internal.gameInterval = setInterval(gameTick, 50); console.log("Game loop started"); } }
function stopGameLoop() { if (window.gameState && gameState.transient.internal.gameInterval) { clearInterval(gameState.transient.internal.gameInterval); gameState.transient.internal.gameInterval = null; console.log("Game loop stopped"); } }
function handleVisibilityChange() { if (!window.gameState) return; if (document.hidden) { gameState.transient.internal.timeBecameHidden = Date.now(); gameState.transient.internal.isActiveSession = false; stopGameLoop(); if (typeof saveGame === 'function') saveGame(); console.log("Tab hidden"); } else { gameState.transient.internal.isActiveSession = true; console.log("Tab visible"); if (typeof updateAllDisplays === 'function') updateAllDisplays(); startGameLoop(); } }

// --- Initialization Function ---
function initializeGame() {
    console.log("--- initializeGame() called ---");
    if (typeof setupUI !== 'function' || !setupUI()) { console.error("FATAL: setupUI failed!"); return; }
    console.log("INIT: setupUI finished execution.");

    loadGame(); // Load game data (Populates window.gameState)
    // Critical check AFTER loadGame
    if (!window.gameState || !window.itemData) {
        console.error("INIT FATAL: gameState or itemData not available after loadGame!");
        const mc = document.getElementById('main-content'); // Try to get main content
        if (mc) mc.innerHTML = '<p style="color:red;">Critical Error: Failed to load game data!</p>';
        return; // Stop
    }
    console.log("INIT: gameState and itemData confirmed available post-load.");
    console.log(`INIT: Gold after load: ${window.gameState.persistent.gold}`);

    if (typeof applyTheme === 'function') { applyTheme(gameState.persistent.settings.theme || 'dark'); }
    if (typeof showInventoryView === 'function') { showInventoryView(); } // Show default view structure
    if (typeof updateAllDisplays === 'function') { updateAllDisplays(); } // Populate default view

    startGameLoop(); // Start the loop

    console.log("INIT: Checking actions to resume...");
    Object.keys(window.gameState.persistent.sessionStartTime || {}).forEach(actionType => { const startTime = window.gameState.persistent.sessionStartTime[actionType]; if (startTime && (Date.now() - startTime < window.gameState.transient.config.maxActionDuration)) { if (typeof startAction === 'function') startAction(actionType, true); } else if (startTime) { window.gameState.persistent.sessionStartTime[actionType] = null; } });
    if (typeof updateAllDisplays === 'function') updateAllDisplays(); // Sync UI after potential resumes

    // Setup intervals/listeners...
    if (window.gameState?.transient?.internal && window.gameState.transient.internal.saveIntervalId) clearInterval(window.gameState.transient.internal.saveIntervalId);
    if (typeof saveGame === 'function' && window.gameState?.transient?.config) { window.gameState.transient.internal.saveIntervalId = setInterval(saveGame, window.gameState.transient.config.saveInterval); }
    document.removeEventListener("visibilitychange", handleVisibilityChange); document.addEventListener("visibilitychange", handleVisibilityChange); console.log("INIT: Visibility listener added.");
    if (typeof logMessage === 'function') { logMessage("Game Initialized.", "info"); /*...*/ }
    console.log("--- initializeGame() fully finished ---");
}

// --- Global Event Listeners ---
if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initializeGame); }
else { initializeGame(); }
window.onbeforeunload = () => { if (window.gameState?.transient?.internal && !window.gameState.transient.internal.isResetting) { if (typeof saveGame === 'function') saveGame(); } };
console.log("main.js loaded.");

// <<<--- END OF COMPLETE main.js SCRIPT ---<<<