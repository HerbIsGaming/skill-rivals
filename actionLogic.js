// <<<--- START OF COMPLETE actionLogic.js SCRIPT (Corrected Pickpocket Duration) ---<<<

// --- Main Game Action Logic ---

// Calculates base time, adjusted by level (simple linear scaling for now)
function calculateBaseActionTime(level, level1Time, capTime, capLevel = window.gameState?.transient?.config?.levelScalingCap || 99) {
    if (!window.gameState?.transient?.config) return level1Time; // Safety check
    if (level <= 1) return level1Time;
    if (level >= capLevel) return capTime;
    const progress = (level - 1) / (capLevel - 1); // How far between level 1 and cap
    return Math.floor(level1Time - (level1Time - capTime) * progress);
} // End calculateBaseActionTime

// Returns the requirement object for a given action
function getActionRequirements(actionType) {
    const config = window.gameState?.transient?.config;
    if (!config) return null; // Need config data
    switch (actionType) {
        case 'chopTree':
            return { equipment: { axe: config.treeTierReq }, skills: { woodcutting: config.treeLevelReq } };
        case 'chopOak':
            return { equipment: { axe: config.oakTierReq }, skills: { woodcutting: config.oakLevelReq } };
        case 'pickpocketMan':
            return { skills: { thieving: config.pickpocketManLevelReq } };
        // Add requirements for new actions here
        default:
            console.warn(`getActionRequirements: Unknown action type ${actionType}`);
            return null;
    }
} // End getActionRequirements

// Function called when an action timer completes
// Returns feedback type string or null ('success', 'stun-fail')
function completeAction(actionType, isOfflineOrBackground = false) {
    if (!window.gameState || !window.itemData || !window.gameState?.transient?.config) {
        console.error("completeAction: Missing essential game data!");
        return null; // Cannot proceed
    }
    const config = gameState.transient.config;
    let xpPerAction = 0;
    let resourceId = null;
    let quantity = 1;
    let activeBonusChance = 0;
    let skillName = null;
    let wasActionSuccessful = false; // Overall success flag for the action attempt
    let wasItemAdded = false;       // Specific flag for item acquisition
    let visualFeedbackType = null;

    // Determine action details based on type
    switch (actionType) {
        case 'chopTree':
            skillName = 'woodcutting'; xpPerAction = config.xpPerLog_Tree; resourceId = 'wood';
            if (gameState.transient.internal.isActiveSession) { activeBonusChance = config.activeWoodBonusChance; }
            wasActionSuccessful = true;
            break;
        case 'chopOak':
            skillName = 'woodcutting'; xpPerAction = config.xpPerLog_Oak; resourceId = 'oakLog';
            if (gameState.transient.internal.isActiveSession) { activeBonusChance = config.activeOakBonusChance; }
            wasActionSuccessful = true;
            break;
        case 'pickpocketMan':
            skillName = 'thieving';
            xpPerAction = config.xpPerPickpocketMan;
            resourceId = null; quantity = 1; activeBonusChance = 0;
            wasActionSuccessful = Math.random() < config.pickpocketManSuccessRate;

            if (wasActionSuccessful) {
                const lootTable = config.pickpocketManLootTable;
                if (lootTable && lootTable.length > 0) {
                    resourceId = lootTable[Math.floor(Math.random() * lootTable.length)];
                } else {
                    if (!isOfflineOrBackground) logMessage("Successfully pickpocketed... but empty pockets.", "warn");
                    wasActionSuccessful = false; // Treat as failure if no loot possible
                }
            } else {
                visualFeedbackType = 'stun-fail';
                if (!isOfflineOrBackground) {
                    const stunDuration = config.pickpocketManStunDuration || 1500;
                    gameState.transient.internal.thievingStunEndTime = Date.now() + stunDuration;
                    logMessage(`Failed to pickpocket! Stunned for ${formatTime(stunDuration)}.`, "error");
                }
                return visualFeedbackType; // Return immediately on failure
            }
            break;
        default:
            console.warn(`completeAction: Unknown action type "${actionType}"`);
            return null; // No feedback for unknown
    }

    // Attempt to add resource (if applicable)
    const isBonusResource = Math.random() < activeBonusChance;
    if (isBonusResource && (actionType === 'chopTree' || actionType === 'chopOak')) {
        quantity = 2;
        if (visualFeedbackType === null) visualFeedbackType = 'success'; // Show success for bonus
    }

    if (resourceId && wasActionSuccessful) {
        if (addItemToInventory(resourceId, quantity, gameState.persistent.inventory, MAX_INV_SLOTS)) {
            wasItemAdded = true;
            if (visualFeedbackType === null) { visualFeedbackType = 'success'; }
            if (!isOfflineOrBackground) { logMessage(`+${quantity} ${itemData[resourceId]?.name || resourceId}${isBonusResource ? ' (Bonus!)' : ''}`, actionType === 'pickpocketMan' ? "action" : "resource"); }
        } else {
            wasActionSuccessful = false; wasItemAdded = false; visualFeedbackType = null;
            if (!isOfflineOrBackground) { stopAction(actionType, false); }
            return null; // Return null on inventory full failure
        }
    } else if (!resourceId && wasActionSuccessful) {
        if (actionType !== 'pickpocketMan' && visualFeedbackType === null) {
            visualFeedbackType = 'success'; // Generic success flash only for non-pickpocket actions without resource result
        }
    }

    // Grant XP if action succeeded overall AND item was acquired (if applicable)
    if (skillName && xpPerAction > 0 && wasActionSuccessful && (resourceId ? wasItemAdded : true)) {
        let finalXp = xpPerAction; let applyBonusText = false;
        if (gameState.transient.internal.isActiveSession) { if ((actionType === 'chopTree' || actionType === 'chopOak') && isBonusResource) { finalXp *= config.activeXpBonusMultiplier; applyBonusText = true; } }
        gainXp(skillName, finalXp, applyBonusText);
    }

    // Restart Logic - only if action truly succeeded this cycle
    if (wasActionSuccessful && !isOfflineOrBackground) {
        if (!checkRequirements(getActionRequirements(actionType))) {
            logMessage(`${actionType.replace(/([A-Z])/g, ' $1')} stopped: Requirements no longer met.`, "warn");
            stopAction(actionType, false);
        } else {
            if (gameState.transient.timers[actionType]?.active) { // Check if it wasn't stopped manually/by error
                startAction(actionType, true); // Attempt restart
            }
        }
    } else if (!wasActionSuccessful && visualFeedbackType !== 'stun-fail' && !isOfflineOrBackground) {
        // Ensure action stops if it failed due to inventory full, etc.
        stopAction(actionType, false);
    }

    return visualFeedbackType; // Return the feedback type for gameTick
} // End of completeAction

// --- startAction ---
// CORRECTED Pickpocket Duration Calculation
function startAction(actionType, isRestart = false) {
    console.log(`%c--- startAction START: ${actionType}, Restart: ${isRestart} ---`, "color: purple; font-weight: bold;");
    if (!window.gameState?.transient?.config) { console.error("startAction failed: gameState or config missing"); return; } // Check gameState & config

    // Stun Check
    if (actionType === 'pickpocketMan') {
        const stunEndTime = gameState.transient.internal.thievingStunEndTime || 0;
        if (stunEndTime > Date.now()) {
            if (!isRestart) { logMessage(`Cannot start ${actionType}: Still stunned.`, "warn"); }
            if (typeof updateSingleActionState === 'function') updateSingleActionState(actionType);
            if (typeof updateSidebarActionDisplay === 'function') updateSidebarActionDisplay();
            return; // Prevent start
        }
    }

    // Requirement Check
    const canPerform = checkRequirements(getActionRequirements(actionType));
    if (!canPerform) {
        if (!isRestart) { logMessage("Requirements not met.", "error"); }
        if (typeof updateSingleActionState === 'function') updateSingleActionState(actionType); // Update button state
        return;
    }

    // Timer Setup
    const timer = gameState.transient.timers[actionType];
    if (!timer) { console.error(`startAction: Timer not defined for ${actionType}`); return; }
    if (timer.active && !isRestart) { console.warn(`startAction: Action ${actionType} already active.`); return; } // Prevent manual restart if active

    // Calculate Duration
    const config = gameState.transient.config;
    let playerLevel = 1;
    let baseTime = 0;
    let variance = 0;

    switch (actionType) {
        case 'chopTree':
            playerLevel = gameState.persistent.skills.woodcutting?.level || 1;
            baseTime = calculateBaseActionTime(playerLevel, config.level1ChopTime_Tree, config.levelCapChopTime_Tree);
            variance = config.chopTimeVariance_Tree || 0; // Default variance to 0 if missing
            break;
        case 'chopOak':
            playerLevel = gameState.persistent.skills.woodcutting?.level || 1;
            baseTime = calculateBaseActionTime(playerLevel, config.level1ChopTime_Oak, config.levelCapChopTime_Oak);
            variance = config.chopTimeVariance_Oak || 0;
            break;
        case 'pickpocketMan':
            playerLevel = gameState.persistent.skills.thieving?.level || 1;
            baseTime = config.pickpocketManTime || 4000;       // Use configured base time, add fallback
            variance = config.pickpocketManVariance || 0;   // Use configured variance, add fallback
            console.log(`Pickpocket Time Calc: Base=${baseTime}, Variance=${variance}`);
            break;
        default:
            console.warn(`startAction: Unknown action type "${actionType}" for duration calc.`);
            return;
    }

    // Calculate final duration with variance, ensure minimum
    timer.currentDuration = Math.max(500, baseTime + (Math.random() * variance) - (variance / 2));
    timer.elapsed = 0; // Reset timer
    timer.active = true;
    console.log(`startAction (${actionType}): Timer activated. Duration: ${timer.currentDuration.toFixed(0)}ms`);

    // Stop other actions and log start only if not a restart
    if (!isRestart) {
        Object.keys(gameState.transient.timers).forEach(otherAction => {
            if (otherAction !== actionType && gameState.transient.timers[otherAction]?.active) {
                stopAction(otherAction, false); // Stop others silently
            }
        });
        gameState.persistent.sessionStartTime[actionType] = Date.now(); // Track start time for offline calc
        logMessage(`Started ${actionType.replace(/([A-Z])/g, ' $1')}...`, "action");
    } else { // For restarts, ensure sessionStartTime exists
        if (!gameState.persistent.sessionStartTime[actionType]) {
            gameState.persistent.sessionStartTime[actionType] = Date.now(); // Set if somehow missing
        }
    }

    // Update UI immediately
    if (typeof updateSingleActionState === 'function') updateSingleActionState(actionType);
    if (typeof updateSidebarActionDisplay === 'function') updateSidebarActionDisplay();
    if (typeof updateActionButtonsState === 'function') updateActionButtonsState();

    console.log(`--- startAction END: ${actionType} ---`);
} // End of startAction

// --- stopAction ---
function stopAction(actionType, logIt = true) {
    if (!window.gameState?.transient?.timers) return; // Safety check
    const timer = gameState.transient.timers[actionType];
    if (!timer || !timer.active) { return; } // Already stopped

    console.log(`%c--- stopAction called for: ${actionType} ---`, "color: orange;");
    timer.active = false;
    timer.elapsed = 0;
    timer.currentDuration = 0;
    // Clear session start time when action stops
    if (gameState.persistent.sessionStartTime?.[actionType]) {
        gameState.persistent.sessionStartTime[actionType] = null;
    }

    if (logIt) { logMessage(`Stopped ${actionType.replace(/([A-Z])/g, ' $1')}.`, "action"); }

    // Update relevant UI elements
    if (typeof updateSingleActionState === 'function') updateSingleActionState(actionType);
    if (typeof updateActionButtonsState === 'function') updateActionButtonsState(); // Important to re-enable button if needed
    if (typeof updateSidebarActionDisplay === 'function') updateSidebarActionDisplay();

    console.log(`--- stopAction END: ${actionType} ---`);
} // End of stopAction


console.log("actionLogic.js loaded.");

// <<<--- END OF COMPLETE actionLogic.js SCRIPT ---<<<