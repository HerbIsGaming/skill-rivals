// --- Skill and XP Logic ---

function gainXp(skillName, amount, isBonus = false) {
    if (!window.gameState || !gameState.persistent.skills[skillName] || amount <= 0) return;
    const skill = gameState.persistent.skills[skillName];
    const bonusText = isBonus ? " (Bonus!)" : "";

    // Use the main logMessage if available, otherwise fallback
    const logFn = typeof logMessage === 'function' ? logMessage : logMessageFallback;
    logFn(`Gained ${amount.toLocaleString()} ${skillName} XP${bonusText}.`, "xp");

    skill.xp += amount;
    let xpNeeded = getXpNeededForLevel(skill.level + 1);
    let levelUps = 0;
    // Loop for multiple level ups from single XP gain
    while (skill.xp >= xpNeeded && xpNeeded > 0) { // Check xpNeeded > 0 to prevent infinite loop at max level
        skill.level++;
        levelUps++;
        skill.xp -= xpNeeded;
        xpNeeded = getXpNeededForLevel(skill.level + 1);
        // Safety break if formula returns 0/negative XP needed before theoretical cap
        if (xpNeeded <= 0 && skill.level < (gameState.transient.config.levelScalingCap || 99)) {
            console.error(`XP needed for level ${skill.level + 1} is zero or negative! Check XP formula.`);
            break;
        }
    }
    if (levelUps > 0) {
        logFn(`${skillName} leveled up to ${skill.level}!`, "levelup");
        // Potentially trigger other level up logic here
    }

    // Update relevant UI elements if they exist
    if (typeof updateSkillDisplay === 'function') updateSkillDisplay();
    if (typeof updateActionButtonsState === 'function') updateActionButtonsState(); // Re-check requirements
}


// Check if player meets item/action requirements
function checkRequirements(requirements) {
    if (!requirements) { return true; } // No requirements = always true

    // Check skills
    if (requirements.skills) {
        for (const skillName in requirements.skills) {
            const requiredLevel = requirements.skills[skillName];
            const playerLevel = window.gameState?.persistent?.skills?.[skillName]?.level || 0;
            // console.log(`Req Check (${skillName}): Need Lvl ${requiredLevel}, Have Lvl ${playerLevel}`); // Debug
            if (playerLevel < requiredLevel) {
                return false; // Skill requirement not met
            }
        }
    }

    // Check equipment (tier)
    if (requirements.equipment) {
        for (const slot in requirements.equipment) {
            const requiredTier = requirements.equipment[slot];
            const equippedItemId = window.gameState?.persistent?.equipment?.[slot];
            const equippedItem = equippedItemId ? window.itemData?.[equippedItemId] : null;
            const equippedTier = equippedItem?.tier ?? 0;
            // console.log(`Req Check (Equip ${slot}): Need Tier ${requiredTier}, Have Tier ${equippedTier}`); // Debug
            if (equippedTier < requiredTier) {
                console.log(`%cReq Check FAILED: Equip ${slot} - Need Tier ${requiredTier}, Have Tier ${equippedTier}`, "color: #FF8888");
                return false; // Equipment requirement not met
            }
        }
    }
    return true; // All checks passed
}

console.log("skillLogic.js loaded.");