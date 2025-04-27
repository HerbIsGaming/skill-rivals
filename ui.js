// --- START OF FILE ui.js ---

// --- UI Update and Interaction Logic ---

// --- DOM Element References ---
let sidebar, mainContent, headerGoldDisplay, skillsNavListEl;
let logContentEl; // Reference to the PERSISTENT log container
let bankGridEl, bankInventoryGridEl, bankPlayerGoldEl, bankGoldEl, bankGoldAmountInput, bankDepositGoldButton, bankWithdrawGoldButton, bankDepositAllGoldButton, bankInventoryCountEl, bankItemCountEl;
let shopStockListEl, shopInventoryListEl, shopPlayerGoldEl;
let sellXModal, sellXItemNameEl, sellXMaxQtyEl, sellXQtyInput, sellXConfirmBtn, sellXCancelBtn, sellXCloseBtn, sellXErrorEl;
let contextMenuEl;
let devPanel, devCloseButton, devPanelToggleButton, devSkillSelect, devLevelInput, devSetLevelButton, devItemSelect, devItemQuantityInput, devGiveItemButton, devResetSaveButton;
let currentSellXIndex = -1;
let currentView = null;

// --- Theme Definitions ---
const themes = { light: "Light", dark: "Dark", forest: "Forest", ocean: "Ocean", midnight: "Midnight" };

// --- Helper: Add Safe Listener (Defined globally within ui.js scope) ---
// Re-adding this helper as it was in the working state before the fatal error
const addSafeListener = (element, eventType, handler, logName) => {
    if (element) {
        // Check if a handler is already stored and remove it
        if (element._storedHandlers && element._storedHandlers[eventType]) {
            element.removeEventListener(eventType, element._storedHandlers[eventType]);
            // console.log(`Removed old listener for ${eventType} on ${logName}`);
        }
        // Initialize stored handlers map if it doesn't exist
        if (!element._storedHandlers) {
            element._storedHandlers = {};
        }
        // Store the new handler reference
        element._storedHandlers[eventType] = handler;
        // Add the new listener
        element.addEventListener(eventType, element._storedHandlers[eventType]);
    } else {
        // console.warn(`Listener Warning: Element for '${logName}' not found during listener setup.`);
    }
};


// --- UI Update Functions ---
function updateAllDisplays() {
    const equipmentDisplayMain = document.getElementById('equipment-display-main');
    const inventoryGridMain = document.getElementById('inventory-grid-main');
    const inventoryCountMain = document.getElementById('inventory-count-main');
    const skillDisplayMain = document.getElementById('skill-display-main'); // Used in Inventory and Skills views
    // log elements are persistent now

    // Update displays IF the relevant elements exist in the current view
    if (skillDisplayMain) updateSkillDisplay(skillDisplayMain);
    if (inventoryGridMain) updateInventoryDisplay(inventoryGridMain, gameState.persistent.inventory, MAX_INV_SLOTS, (idx) => equipItemFromSlot(idx), inventoryCountMain);
    if (equipmentDisplayMain) updateEquipmentDisplay(equipmentDisplayMain);

    const actionListContainer = document.getElementById('action-list-container');
    if (actionListContainer) {
        updateActionButtonsState();
        updateAllActionProgress();
    }

    updateGoldDisplays(); // Header gold is always visible

    // logContentEl is now persistent, no need to update it here

    // Update bank/shop only if they are the current view
    if (currentView === 'bank') { updateBankDisplay(); }
    if (currentView === 'shop') { updateShopDisplay(); }
}
window.updateAllDisplays = updateAllDisplays;

function updateSkillDisplay(targetElement = document.getElementById('skill-display-main')) { // Function remains, target ID is reused
    if (!targetElement) return;
    targetElement.innerHTML = ''; // Clear previous content
    targetElement.classList.add('skill-display-list'); // Add class for styling

    const skills = gameState.persistent.skills;
    for (const id in skills) {
        const skill = skills[id];
        const div = document.createElement('div');
        div.classList.add('skill-display-item'); // Class for individual skill styling

        const xpForNext = getXpNeededForLevel(skill.level + 1);
        const currentLevelXP = skill.xp;
        const xpToShow = currentLevelXP.toLocaleString();
        const xpNeededToShow = xpForNext > 0 ? xpForNext.toLocaleString() : 'MAX';

        div.textContent = `${id.charAt(0).toUpperCase() + id.slice(1)} Lvl: `;
        const span = document.createElement('span');
        span.textContent = `${skill.level} (${xpToShow}/${xpNeededToShow} XP)`;
        div.appendChild(span);

        if (xpForNext > 0) {
            const progressContainer = document.createElement('div');
            progressContainer.className = 'skill-xp-bar-container';
            const progressBar = document.createElement('div');
            progressBar.className = 'skill-xp-bar';
            const progressPercent = Math.min(100, (currentLevelXP / xpForNext) * 100);
            progressBar.style.width = `${progressPercent}%`;
            progressContainer.appendChild(progressBar);
            div.appendChild(progressContainer);
        }
        targetElement.appendChild(div);
    }
}
function updateGoldDisplays() { if (!headerGoldDisplay) { headerGoldDisplay = document.getElementById('player-gold'); if (!headerGoldDisplay) { console.error("CRITICAL: FAILED re-acquire headerGoldDisplay!"); return; } } const goldValue = gameState.persistent.gold ?? 0; const bankGoldValue = gameState.persistent.bankGold ?? 0; try { headerGoldDisplay.textContent = goldValue.toLocaleString(); } catch (e) { console.error("ERR updating headerGoldDisplay:", e); } bankPlayerGoldEl = document.getElementById('bank-player-gold'); bankGoldEl = document.getElementById('bank-gold'); shopPlayerGoldEl = document.getElementById('shop-player-gold'); if (bankPlayerGoldEl) { try { bankPlayerGoldEl.textContent = goldValue.toLocaleString(); } catch (e) { console.error("ERR updating bankPlayerGoldEl:", e); } } if (bankGoldEl) { try { bankGoldEl.textContent = bankGoldValue.toLocaleString(); } catch (e) { console.error("ERR updating bankGoldEl:", e); } } if (shopPlayerGoldEl) { try { shopPlayerGoldEl.textContent = goldValue.toLocaleString(); } catch (e) { console.error("ERR updating shopPlayerGoldEl:", e); } } }

function updateInventoryDisplay(targetGridEl, sourceArray, slotLimit, clickHandler, countElement = null, hideEmpty = false) {
    if (!targetGridEl) { return; }
    targetGridEl.innerHTML = '';
    let itemCount = 0;

    for (let i = 0; i < slotLimit; i++) {
        const slotData = sourceArray[i];
        if (!slotData && hideEmpty) continue;
        const slot = document.createElement('div');
        slot.classList.add('inventory-slot');
        slot.setAttribute('data-index', i);

        const oldClickHandler = slot._clickHandler;
        const oldContextMenuHandler = slot._contextMenuHandler;
        if (oldClickHandler) slot.removeEventListener('click', oldClickHandler);
        if (oldContextMenuHandler) slot.removeEventListener('contextmenu', oldContextMenuHandler);
        slot._clickHandler = null;
        slot._contextMenuHandler = null;

        if (slotData) {
            itemCount++;
            const item = itemData[slotData.id];
            let tooltipText = '';
            if (item) { tooltipText += item.name; if (item.description) { tooltipText += `\n${item.description}`; } if (slotData.quantity > 1) { tooltipText += `\nQuantity: ${slotData.quantity.toLocaleString()}`; } let finalSellValue = 0; if (typeof item.sellPrice === 'number' && item.sellPrice > 0) { finalSellValue = item.sellPrice; } else if (item.buyPrice && item.buyPrice > 0) { finalSellValue = Math.max(1, Math.floor(item.buyPrice * gameState.transient.config.sellPriceRatio)); } if (finalSellValue > 0) { tooltipText += `\nSell Value: ${finalSellValue.toLocaleString()} GP`; } slot.textContent = item?.name?.substring(0, 3) || slotData.id.substring(0, 3); /* Display text fallback */ } else { tooltipText = `${slotData.id} (x${slotData.quantity.toLocaleString()})`; slot.textContent = slotData.id.substring(0, 3); /* Display text fallback */ }
            slot.title = tooltipText;

            if (item && item.stackLimit > 1 && slotData.quantity > 1) { const quantity = document.createElement('span'); quantity.classList.add('item-quantity'); quantity.textContent = slotData.quantity > 9999 ? (Math.floor(slotData.quantity / 1000) + 'k') : slotData.quantity.toLocaleString(); slot.appendChild(quantity); }

            if (typeof clickHandler === 'function') {
                slot._clickHandler = () => clickHandler(i);
                addSafeListener(slot, 'click', slot._clickHandler, `slot[${i}]-click`);
            }
            const gridId = targetGridEl.id;
            if (gridId === 'inventory-grid-main' || gridId === 'bank-inventory-grid' || gridId === 'bank-grid') {
                // Use specific context menu handlers based on grid
                if (gridId === 'inventory-grid-main') {
                    slot._contextMenuHandler = (event) => showContextMenu(event, i);
                } else if (gridId === 'bank-grid') {
                    slot._contextMenuHandler = (event) => showBankContextMenu(event, i);
                } else if (gridId === 'bank-inventory-grid') {
                    slot._contextMenuHandler = (event) => showBankInvContextMenu(event, i);
                }

                if (slot._contextMenuHandler) {
                    addSafeListener(slot, 'contextmenu', slot._contextMenuHandler, `${gridId} slot[${i}]-context`);
                } else {
                    // Fallback to a generic handler if specific one not found/needed
                    addSafeListener(slot, 'contextmenu', handleContextMenuClick, `${gridId} slot[${i}]-context`);
                }
            }
        } else {
            slot.classList.add('empty-slot');
        }
        targetGridEl.appendChild(slot);
    }

    bankInventoryCountEl = document.getElementById('bank-inventory-count');
    bankItemCountEl = document.getElementById('bank-item-count');

    if (countElement) {
        countElement.textContent = sourceArray.filter(s => s !== null).length;
    }
    if (bankInventoryCountEl && (targetGridEl.id === 'inventory-grid-main' || targetGridEl.id === 'bank-inventory-grid')) {
        const mainInvCount = gameState.persistent.inventory.filter(s => s !== null).length;
        bankInventoryCountEl.textContent = mainInvCount;
    }
    if (bankItemCountEl && targetGridEl.id === 'bank-grid') {
        bankItemCountEl.textContent = sourceArray.filter(s => s !== null).length;
    }

    if (hideEmpty && itemCount === 0) {
        targetGridEl.style.minHeight = '60px';
        targetGridEl.innerHTML = '<div class="empty-slot">(Empty)</div>';
    } else if (hideEmpty) {
        targetGridEl.style.minHeight = '';
    }
}

function equipItemFromSlot(invIdx) { const slot = gameState.persistent.inventory[invIdx]; if (slot && itemData[slot.id]?.type === 'equipment') { equipItem(slot.id); } else if (slot) { logMessage("You can't equip that.", "info"); } }
function updateEquipmentDisplay(targetElement = document.getElementById('equipment-display-main')) { if (!targetElement) return; targetElement.innerHTML = ''; const equipSlots = ['axe']; const slotLabels = { axe: 'Axe' }; equipSlots.forEach(slotKey => { const slotDiv = document.createElement('div'); slotDiv.id = `equip-slot-${slotKey}`; const equippedItemId = gameState.persistent.equipment[slotKey]; const equippedItem = equippedItemId ? itemData[equippedItemId] : null; slotDiv.textContent = `${slotLabels[slotKey] || slotKey.charAt(0).toUpperCase() + slotKey.slice(1)}: `; const span = document.createElement('span'); span.textContent = equippedItem ? `${equippedItem.name}` : '(None)'; span.style.fontWeight = equippedItem ? 'bold' : 'normal'; if (equippedItem) span.classList.add('equipped-item-name'); slotDiv.appendChild(span); targetElement.appendChild(slotDiv); }); }
function updateActionButtonsState() { const container = document.getElementById('action-list-container'); if (!container) return; const buttons = container.querySelectorAll('button.start-button'); buttons.forEach(button => { const actionType = button.dataset.action; if (!actionType) return; const reqs = getActionRequirements(actionType); const canPerform = checkRequirements(reqs); button.disabled = !canPerform; const reqEl = button.closest('.action-item')?.querySelector('.requirements'); if (reqEl) { reqEl.style.display = canPerform ? 'none' : 'block'; if (!canPerform && reqs) { let parts = []; if (reqs.skills) { for (const skill in reqs.skills) { parts.push(`Lvl ${reqs.skills[skill]} ${skill.charAt(0).toUpperCase() + skill.slice(1)}`); } } if (reqs.equipment?.axe) { parts.push(`Tier ${reqs.equipment.axe} Axe`); } reqEl.textContent = "Requires: " + parts.join(', '); } } }); }
function updateSingleActionState(actionType, feedback = null) { const container = document.getElementById(`action-${actionType}`); if (!container) return; const startButton = container.querySelector('.start-button'); const stopButton = container.querySelector('.stop-button'); const progressBar = container.querySelector('.progress-bar'); const statusEl = container.querySelector('.action-status'); const timer = gameState?.transient?.timers?.[actionType]; if (!startButton || !stopButton || !progressBar || !statusEl || !timer) { return; } const isStunned = actionType === 'pickpocketMan' && gameState.transient.internal.thievingStunEndTime > Date.now(); if (timer.active && !isStunned) { startButton.style.display = 'none'; stopButton.style.display = 'inline-block'; const progress = timer.currentDuration > 0 ? (timer.elapsed / timer.currentDuration) * 100 : 0; progressBar.style.width = `${Math.min(100, progress)}%`; statusEl.textContent = `Working... (${formatTime(Math.max(0, timer.currentDuration - timer.elapsed))} left)`; progressBar.classList.remove('stunned'); } else if (isStunned) { startButton.style.display = 'none'; stopButton.style.display = 'inline-block'; const stunRemaining = gameState.transient.internal.thievingStunEndTime - Date.now(); const stunDuration = gameState.transient.config?.pickpocketManStunDuration || stunRemaining; const progress = stunDuration > 0 ? ((stunDuration - stunRemaining) / stunDuration) * 100 : 0; progressBar.style.width = `${Math.min(100, progress)}%`; statusEl.textContent = `Stunned (${formatTime(stunRemaining)} left)`; progressBar.classList.add('stunned'); } else { startButton.style.display = 'inline-block'; stopButton.style.display = 'none'; progressBar.style.width = '0%'; statusEl.textContent = ''; progressBar.classList.remove('stunned'); } if (feedback) { container.classList.remove('flash-success', 'flash-fail'); requestAnimationFrame(() => { container.classList.add(`flash-${feedback}`); const onAnimationEnd = () => { container.classList.remove(`flash-${feedback}`); container.removeEventListener('animationend', onAnimationEnd); }; container.addEventListener('animationend', onAnimationEnd); }); } }
function updateAllActionProgress() { const container = document.getElementById('action-list-container'); if (!container || !gameState?.transient?.timers) return; Object.keys(gameState.transient.timers).forEach(actionType => { const actionItemExists = container.querySelector(`#action-${actionType}`); if (actionItemExists) { updateSingleActionState(actionType); } }); updateSidebarActionDisplay(); } // Also update sidebar display
function updateSidebarActionDisplay(feedback = null, feedbackAction = null) { const sidebarActionPanel = document.getElementById('sidebar-action-display'); if (!sidebarActionPanel) { console.warn("updateSidebarActionDisplay: Sidebar action panel element not found."); return; } const sidebarActionInfo = document.getElementById('sidebar-action-info'); const sidebarActionPlaceholder = document.getElementById('sidebar-action-placeholder'); const sidebarActionIcon = document.getElementById('sidebar-action-icon'); const sidebarActionName = document.getElementById('sidebar-action-name'); const sidebarActionSkill = document.getElementById('sidebar-action-skill'); const sidebarProgressBarContainer = document.getElementById('sidebar-action-progress-container'); const sidebarProgressBar = document.getElementById('sidebar-action-progress-bar'); if (!sidebarActionInfo || !sidebarActionPlaceholder || !sidebarActionIcon || !sidebarActionName || !sidebarActionSkill || !sidebarProgressBarContainer || !sidebarProgressBar) { console.warn("updateSidebarActionDisplay: Missing sidebar action detail elements."); return; } const anyActionActive = Object.values(gameState.transient.timers || {}).some(t => t.active); const isStunnedGlobal = gameState.transient.internal?.thievingStunEndTime > Date.now(); if (anyActionActive || isStunnedGlobal) { sidebarActionInfo.style.display = 'flex'; sidebarActionPlaceholder.style.display = 'none'; let activeActionType = null; for (const type in gameState.transient.timers) { if (gameState.transient.timers[type].active) { activeActionType = type; break; } } if (isStunnedGlobal && !activeActionType) { const stunRemaining = gameState.transient.internal.thievingStunEndTime - Date.now(); const initialStunDuration = gameState.transient.config?.pickpocketManStunDuration || 3000; const progressPercent = initialStunDuration > 0 ? ((initialStunDuration - stunRemaining) / initialStunDuration) * 100 : 0; sidebarActionName.textContent = 'Stunned'; sidebarActionSkill.textContent = 'Thieving'; sidebarActionIcon.innerHTML = `<i class="fas fa-dizzy"></i>`; sidebarProgressBar.style.width = `${Math.min(100, Math.max(0, progressPercent))}%`; sidebarProgressBarContainer.classList.add('stunned'); if (feedback && feedbackAction === 'pickpocketMan' && feedback === 'stun-fail') { sidebarActionPanel.classList.remove('flash-success', 'flash-fail'); requestAnimationFrame(() => { sidebarActionPanel.classList.add(`flash-fail`); const onAnimationEnd = () => { sidebarActionPanel.classList.remove(`flash-fail`); sidebarActionPanel.removeEventListener('animationend', onAnimationEnd); }; sidebarActionPanel.addEventListener('animationend', onAnimationEnd); }); } else { sidebarActionPanel.classList.remove('flash-success', 'flash-fail'); } } else if (activeActionType) { const activeTimer = gameState.transient.timers[activeActionType]; const actionName = activeActionType.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()); sidebarActionName.textContent = actionName; let skillName = ''; if (activeActionType.startsWith('chop')) skillName = 'Woodcutting'; else if (activeActionType.startsWith('pickpocket')) skillName = 'Thieving'; sidebarActionSkill.textContent = skillName; let iconClass = 'fas fa-dot-circle'; if (activeActionType === 'chopTree' || activeActionType === 'chopOak') iconClass = 'fas fa-tree'; else if (activeActionType === 'pickpocketMan') iconClass = 'fas fa-hand-rock'; sidebarActionIcon.innerHTML = `<i class="${iconClass}"></i>`; const progress = activeTimer.currentDuration > 0 ? (activeTimer.elapsed / activeTimer.currentDuration) * 100 : 0; sidebarProgressBar.style.width = `${Math.min(100, progress)}%`; sidebarProgressBarContainer.classList.remove('stunned'); if (feedback && feedbackAction === activeActionType) { sidebarActionPanel.classList.remove('flash-success', 'flash-fail'); const flashType = feedback === 'success' ? 'flash-success' : (feedback === 'stun-fail' ? 'flash-fail' : null); if (flashType) { requestAnimationFrame(() => { sidebarActionPanel.classList.add(flashType); const onAnimationEnd = () => { sidebarActionPanel.classList.remove(flashType); sidebarActionPanel.removeEventListener('animationend', onAnimationEnd); }; sidebarActionPanel.addEventListener('animationend', onAnimationEnd); }); } } else { sidebarActionPanel.classList.remove('flash-success', 'flash-fail'); } } else { sidebarActionInfo.style.display = 'none'; sidebarActionPlaceholder.style.display = 'block'; sidebarActionPanel.classList.remove('flash-success', 'flash-fail'); } } else { sidebarActionInfo.style.display = 'none'; sidebarActionPlaceholder.style.display = 'block'; sidebarActionPanel.classList.remove('flash-success', 'flash-fail'); } }

function updateBankDisplay() {
    bankInventoryGridEl = document.getElementById('bank-inventory-grid');
    bankGridEl = document.getElementById('bank-grid');
    bankInventoryCountEl = document.getElementById('bank-inventory-count');
    bankItemCountEl = document.getElementById('bank-item-count');

    if (!bankInventoryGridEl || !bankGridEl || !bankInventoryCountEl || !bankItemCountEl) { return; }
    updateInventoryDisplay(bankInventoryGridEl, gameState.persistent.inventory, MAX_INV_SLOTS, null, bankInventoryCountEl, false);
    updateInventoryDisplay(bankGridEl, gameState.persistent.bankInventory, MAX_BANK_SLOTS, (idx) => withdrawItemStack(idx), bankItemCountEl, true);
    updateGoldDisplays();
}

function updateShopDisplay() {
    shopStockListEl = document.getElementById('shop-stock-list');
    shopInventoryListEl = document.getElementById('shop-inventory-list');
    shopPlayerGoldEl = document.getElementById('shop-player-gold');

    if (!shopStockListEl || !shopInventoryListEl || !shopPlayerGoldEl) { return; }

    shopStockListEl.innerHTML = ''; let stockItemsRendered = 0;
    for (const itemId in SHOP_STOCK) { const item = itemData[itemId]; const stockAmount = SHOP_STOCK[itemId]; if (item && stockAmount > 0) { stockItemsRendered++; const li = document.createElement('li'); const details = document.createElement('span'); details.classList.add('shop-item-details'); const nameSpan = document.createElement('span'); nameSpan.classList.add('item-name'); nameSpan.textContent = item.name; details.appendChild(nameSpan); if (item.buyPrice) { const priceSpan = document.createElement('span'); priceSpan.classList.add('item-price'); priceSpan.textContent = `(${item.buyPrice.toLocaleString()} GP)`; details.appendChild(priceSpan); } else { const priceSpan = document.createElement('span'); priceSpan.classList.add('item-price'); priceSpan.textContent = `(N/A)`; details.appendChild(priceSpan); } li.appendChild(details); if (item.buyPrice) { const action = document.createElement('span'); action.classList.add('shop-action'); const buyButton = document.createElement('button'); buyButton.textContent = 'Buy 1'; buyButton.onclick = () => buyItem(itemId); buyButton.disabled = gameState.persistent.gold < item.buyPrice; action.appendChild(buyButton); li.appendChild(action); } shopStockListEl.appendChild(li); } } if (stockItemsRendered === 0) shopStockListEl.innerHTML = '<li class="empty-slot">(Shop empty)</li>';

    shopInventoryListEl.innerHTML = ''; let sellableItems = 0;
    for (let i = 0; i < MAX_INV_SLOTS; i++) { const slot = gameState.persistent.inventory[i]; if (slot) { const item = itemData[slot.id]; let finalSellValue = 0; if (typeof item?.sellPrice === 'number' && item.sellPrice > 0) { finalSellValue = item.sellPrice; } else if (item?.buyPrice && item.buyPrice > 0) { finalSellValue = Math.max(1, Math.floor(item.buyPrice * gameState.transient.config.sellPriceRatio)); } if (item && finalSellValue > 0) { sellableItems++; const li = document.createElement('li'); li.setAttribute('data-index', i); const details = document.createElement('span'); details.classList.add('shop-item-details'); const nameSpan = document.createElement('span'); nameSpan.classList.add('item-name'); nameSpan.textContent = `${slot.quantity.toLocaleString()}x ${item.name}`; details.appendChild(nameSpan); const priceSpan = document.createElement('span'); priceSpan.classList.add('item-price'); priceSpan.textContent = `(${finalSellValue.toLocaleString()} GP ea)`; details.appendChild(priceSpan); li.appendChild(details); const action = document.createElement('span'); action.classList.add('shop-action'); const sell1Button = document.createElement('button'); sell1Button.textContent = 'Sell 1'; sell1Button.onclick = () => sellItem(i); action.appendChild(sell1Button); if (slot.quantity > 1) { const sellXButton = document.createElement('button'); sellXButton.textContent = 'Sell X'; sellXButton.onclick = () => openSellXModal(i); action.appendChild(sellXButton); const sellAllButton = document.createElement('button'); sellAllButton.textContent = 'Sell All'; sellAllButton.onclick = () => sellItemAll(i); action.appendChild(sellAllButton); } li.appendChild(action); shopInventoryListEl.appendChild(li); } } } if (sellableItems === 0) shopInventoryListEl.innerHTML = '<li class="empty-slot">(No sellable items)</li>';

    updateGoldDisplays();
}
// ----- END OF PART 1 -----


// ----- START OF PART 2 -----
// --- Sell X Modal Logic ---
function openSellXModal(inventoryIndex) { if (!sellXModal) { console.error("Sell X Modal element not found!"); return; } const slot = gameState.persistent.inventory[inventoryIndex]; if (!slot) { console.error(`openSellXModal: No slot data at index ${inventoryIndex}`); return; } const item = itemData[slot.id]; if (!item) { console.error(`openSellXModal: No item data for ID ${slot.id}`); return; } currentSellXIndex = inventoryIndex; if (sellXItemNameEl) sellXItemNameEl.textContent = item.name; if (sellXMaxQtyEl) sellXMaxQtyEl.textContent = slot.quantity.toLocaleString(); if (sellXQtyInput) { sellXQtyInput.value = 1; sellXQtyInput.max = slot.quantity; } if (sellXErrorEl) { sellXErrorEl.textContent = ''; sellXErrorEl.style.display = 'none'; } sellXModal.classList.remove('sell-x-modal-hidden'); if (sellXQtyInput) sellXQtyInput.focus(); }
function closeSellXModal() { if (!sellXModal) return; sellXModal.classList.add('sell-x-modal-hidden'); if (sellXQtyInput) sellXQtyInput.value = 1; currentSellXIndex = -1; if (sellXErrorEl) { sellXErrorEl.textContent = ''; sellXErrorEl.style.display = 'none'; } }
function confirmSellX() { if (currentSellXIndex < 0 || !sellXQtyInput || !sellXErrorEl) { console.error("confirmSellX called with invalid state or missing elements."); closeSellXModal(); return; } const slot = gameState.persistent.inventory[currentSellXIndex]; if (!slot) { console.error("confirmSellX: Slot data disappeared?"); closeSellXModal(); return; } const maxQuantity = slot.quantity; const quantity = parseInt(sellXQtyInput.value); if (isNaN(quantity) || quantity <= 0) { sellXErrorEl.textContent = "Please enter a valid quantity (> 0)."; sellXErrorEl.style.display = 'block'; return; } if (quantity > maxQuantity) { sellXErrorEl.textContent = `You only have ${maxQuantity.toLocaleString()}.`; sellXErrorEl.style.display = 'block'; return; } sellXErrorEl.textContent = ''; sellXErrorEl.style.display = 'none'; sellItemQuantity(currentSellXIndex, quantity); closeSellXModal(); }

// --- Dev Panel ---
function toggleDevPanel() { if (!devPanel) { console.error("toggleDevPanel: devPanel element not found or assigned."); return; } devPanel.classList.toggle('dev-panel-hidden'); logMessage(`Dev Panel ${devPanel.classList.contains('dev-panel-hidden') ? 'hidden' : 'shown'}.`, "debug"); }

// --- Theme Handling ---
function applyTheme(themeKey) { if (!themes[themeKey]) { console.warn(`Tried to apply unknown theme: ${themeKey}. Defaulting to dark.`); themeKey = 'dark'; } document.body.className = `${themeKey}-theme`; gameState.persistent.settings.theme = themeKey; const currentThemeLabel = document.getElementById('current-theme-label'); if (currentThemeLabel) { currentThemeLabel.textContent = `Current: ${themes[themeKey]}`; } const themeSelect = document.getElementById('theme-select'); if (themeSelect) { themeSelect.value = themeKey; } }
function populateThemeSelector() { const themeSelect = document.getElementById('theme-select'); if (!themeSelect) return; themeSelect.innerHTML = ''; for (const key in themes) { const option = document.createElement('option'); option.value = key; option.textContent = themes[key]; themeSelect.appendChild(option); } themeSelect.value = gameState.persistent.settings.theme; }

// --- Skill Navigation ---
function populateSkillNav() { if (!skillsNavListEl || !gameState.persistent.skills) return; skillsNavListEl.innerHTML = ''; Object.keys(gameState.persistent.skills).sort().forEach(skillId => { const skillName = skillId.charAt(0).toUpperCase() + skillId.slice(1); const li = document.createElement('li'); const a = document.createElement('a'); a.href = "#"; a.id = `nav-skill-${skillId}`; a.innerHTML = `<i class="fas fa-book"></i> ${skillName}`; a.addEventListener('click', (e) => { e.preventDefault(); showSkillActions(skillId); }); li.appendChild(a); skillsNavListEl.appendChild(li); }); }

// --- Context Menus ---
function hideContextMenu() { if (contextMenuEl) { contextMenuEl.classList.add('context-menu-hidden'); const ul = contextMenuEl.querySelector('ul'); if (ul) ul.innerHTML = ''; } document.removeEventListener('click', handleGlobalLeftClick); } // Also remove global listener
function showContextMenu(event, inventoryIndex) { event.preventDefault(); hideContextMenu(); if (!contextMenuEl) return; const slot = gameState.persistent.inventory[inventoryIndex]; const contextMenuUl = contextMenuEl.querySelector('ul'); if (!slot || !contextMenuUl) { hideContextMenu(); return; } contextMenuUl.innerHTML = ''; const item = itemData[slot.id]; let actions = []; if (item) { if (item.type === 'equipment') { actions.push({ text: 'Equip', action: () => equipItem(slot.id) }); } } else { console.error(`Context menu: Missing item data for ID: ${slot.id}`); } actions.push({ text: 'Drop', action: () => dropItem(inventoryIndex) }); if (actions.length === 0) { hideContextMenu(); return; } actions.forEach(actionInfo => { const li = document.createElement('li'); li.textContent = actionInfo.text; li.addEventListener('click', (e) => { e.stopPropagation(); if (typeof actionInfo.action === 'function') actionInfo.action(); hideContextMenu(); }); contextMenuUl.appendChild(li); }); contextMenuEl.style.left = `${event.clientX + 2}px`; contextMenuEl.style.top = `${event.clientY + 2}px`; contextMenuEl.classList.remove('context-menu-hidden'); document.addEventListener('click', handleGlobalLeftClick); } // Add global listener when shown
function showBankContextMenu(event, bankIndex) { event.preventDefault(); hideContextMenu(); if (!contextMenuEl) return; const slot = gameState.persistent.bankInventory[bankIndex]; const contextMenuUl = contextMenuEl.querySelector('ul'); if (!slot || !contextMenuUl) { hideContextMenu(); return; } contextMenuUl.innerHTML = ''; const item = itemData[slot.id]; let actions = []; if (item) { actions.push({ text: 'Withdraw 1', action: () => withdrawItem(bankIndex) }); if (slot.quantity > 1) { actions.push({ text: `Withdraw All (${slot.quantity.toLocaleString()})`, action: () => withdrawItemStack(bankIndex) }); } } else { console.error(`Bank Context menu: Missing item data for ID: ${slot.id}`); } if (actions.length === 0) { hideContextMenu(); return; } actions.forEach(actionInfo => { const li = document.createElement('li'); li.textContent = actionInfo.text; li.addEventListener('click', (e) => { e.stopPropagation(); if (typeof actionInfo.action === 'function') actionInfo.action(); hideContextMenu(); }); contextMenuUl.appendChild(li); }); contextMenuEl.style.left = `${event.clientX + 2}px`; contextMenuEl.style.top = `${event.clientY + 2}px`; contextMenuEl.classList.remove('context-menu-hidden'); document.addEventListener('click', handleGlobalLeftClick); } // Add global listener
function showBankInvContextMenu(event, inventoryIndex) { event.preventDefault(); hideContextMenu(); if (!contextMenuEl) return; const slot = gameState.persistent.inventory[inventoryIndex]; const contextMenuUl = contextMenuEl.querySelector('ul'); if (!slot || !contextMenuUl) { hideContextMenu(); return; } contextMenuUl.innerHTML = ''; const item = itemData[slot.id]; let actions = []; if (item) { actions.push({ text: 'Deposit 1', action: () => depositItemOne(inventoryIndex) }); if (slot.quantity > 1) { actions.push({ text: `Deposit All (${slot.quantity.toLocaleString()})`, action: () => depositItemStack(inventoryIndex) }); } } else { console.error(`Bank Inv Context menu: Missing item data for ID: ${slot.id}`); } if (actions.length === 0) { hideContextMenu(); return; } actions.forEach(actionInfo => { const li = document.createElement('li'); li.textContent = actionInfo.text; li.addEventListener('click', (e) => { e.stopPropagation(); if (typeof actionInfo.action === 'function') actionInfo.action(); hideContextMenu(); }); contextMenuUl.appendChild(li); }); contextMenuEl.style.left = `${event.clientX + 2}px`; contextMenuEl.style.top = `${event.clientY + 2}px`; contextMenuEl.classList.remove('context-menu-hidden'); document.addEventListener('click', handleGlobalLeftClick); } // Add global listener
function handleContextMenuClick(event) { const targetSlot = event.target.closest('.inventory-slot[data-index]'); if (!targetSlot) { hideContextMenu(); return; } const index = parseInt(targetSlot.getAttribute('data-index')); if (isNaN(index)) { hideContextMenu(); return; } const targetInventoryGrid = targetSlot.closest('#inventory-grid-main'); const targetBankGrid = targetSlot.closest('#bank-grid'); const targetBankInvGrid = targetSlot.closest('#bank-inventory-grid'); if (targetInventoryGrid && gameState.persistent.inventory[index]) { showContextMenu(event, index); } else if (targetBankGrid && gameState.persistent.bankInventory[index]) { showBankContextMenu(event, index); } else if (targetBankInvGrid && gameState.persistent.inventory[index]) { showBankInvContextMenu(event, index); } else { hideContextMenu(); } }
function handleGlobalLeftClick(event) { if (contextMenuEl && !contextMenuEl.classList.contains('context-menu-hidden')) { if (!contextMenuEl.contains(event.target)) { const targetSlot = event.target.closest('.inventory-slot[data-index]'); if (!targetSlot) { hideContextMenu(); } } } } // Simplified check

// --- View Switching Functions ---
function clearMainContent() {
    if (mainContent) {
        mainContent.innerHTML = '';
    }
    currentView = null;
    // Hide any open context menu when switching views
    hideContextMenu();
}

function setActiveNavLink(navId) {
    document.querySelectorAll('#sidebar .sidebar-nav a').forEach(link => {
        link.classList.remove('active');
    });
    const activeLink = document.getElementById(navId);
    if (activeLink) {
        activeLink.classList.add('active');
    }
}

function showInventoryView() {
    clearMainContent();
    setActiveNavLink('nav-inventory');
    currentView = 'inventory';
    if (!mainContent) return;
    mainContent.innerHTML = `
        <h2 class="page-header">Inventory & Equipment</h2>
        <div class="content-panel"> <h3>Equipment</h3> <div id="equipment-display-main"></div> </div>
        <div class="content-panel"> <h3>Inventory (<span id="inventory-count-main">0</span>/${MAX_INV_SLOTS} Slots)</h3> <div id="inventory-grid-main" class="item-grid"></div> </div>
        <!-- Skills panel removed -->
    `;
    const equipmentDisplayMain = document.getElementById('equipment-display-main');
    const inventoryGridMain = document.getElementById('inventory-grid-main');
    const inventoryCountMain = document.getElementById('inventory-count-main');
    // logContentEl is persistent

    if (equipmentDisplayMain) updateEquipmentDisplay(equipmentDisplayMain);
    if (inventoryGridMain) updateInventoryDisplay(inventoryGridMain, gameState.persistent.inventory, MAX_INV_SLOTS, (idx) => equipItemFromSlot(idx), inventoryCountMain, false);

    addSafeListener(inventoryGridMain, 'contextmenu', handleContextMenuClick, 'inventoryGridMainContextMenu');
}

function showSkillsView() {
    clearMainContent();
    setActiveNavLink('nav-skills-main');
    currentView = 'skills';
    if (!mainContent) return;
    mainContent.innerHTML = `
        <h2 class="page-header">Skills</h2>
        <div class="content-panel">
            <div id="skill-display-main"></div> <!-- Reusing ID for update function -->
        </div>
    `;
    const skillDisplayMain = document.getElementById('skill-display-main');
    if (skillDisplayMain) {
        updateSkillDisplay(skillDisplayMain);
    }
}

function showSkillActions(skillId) {
    clearMainContent();
    setActiveNavLink(`nav-skill-${skillId}`);
    currentView = `skill-${skillId}`;
    if (!mainContent) return;
    const skillName = skillId.charAt(0).toUpperCase() + skillId.slice(1);
    mainContent.innerHTML = `
        <h2 class="page-header">${skillName} Actions</h2>
        <div id="action-list-container" class="action-list"> </div>
        <!-- Log is persistent -->
    `;
    const actionListContainer = document.getElementById('action-list-container');
    // logContentEl is persistent

    if (!actionListContainer) return;
    let relevantActions = [];
    if (skillId === 'woodcutting') { relevantActions = ['chopTree', 'chopOak']; }
    else if (skillId === 'thieving') { relevantActions = ['pickpocketMan']; }

    if (relevantActions.length === 0) { actionListContainer.innerHTML = `<p>No actions available for ${skillName} yet.</p>`; return; }

    relevantActions.forEach(actionType => {
        const actionName = actionType.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        const div = document.createElement('div'); div.classList.add('action-item'); div.id = `action-${actionType}`;
        div.innerHTML = `<h4>${actionName}</h4> <button class="start-button" data-action="${actionType}">Start</button> <button class="stop-button" data-action="${actionType}" style="display: none;">Stop</button> <div class="progress-bar-container"><div class="progress-bar"></div></div> <div class="action-status"></div> <div class="requirements" style="display: none;"></div>`;
        actionListContainer.appendChild(div);
        const startBtn = div.querySelector('.start-button');
        const stopBtn = div.querySelector('.stop-button');
        if (startBtn) { addSafeListener(startBtn, 'click', () => startAction(actionType), `start-${actionType}`); }
        if (stopBtn) { addSafeListener(stopBtn, 'click', () => stopAction(actionType), `stop-${actionType}`); }
        updateSingleActionState(actionType); // Initial state update
    });
    updateActionButtonsState(); // Update all button disabled states
}

function showBankView() {
    clearMainContent();
    setActiveNavLink('nav-bank');
    currentView = 'bank';
    if (!mainContent) return;

    mainContent.innerHTML = `
        <h2 class="page-header">Bank</h2>
        <div class="content-panel">
            <div class="bank-sections">
                <div class="bank-inventory-section"><h3>Bank Items (<span id="bank-item-count">0</span>/${MAX_BANK_SLOTS})</h3><div id="bank-grid" class="item-grid"></div></div>
                <div class="bank-inventory-section"><h3>Inventory (<span id="bank-inventory-count">0</span>/${MAX_INV_SLOTS})</h3><div id="bank-inventory-grid" class="item-grid"></div></div>
            </div>
            <div class="bank-gold-section">
                <div>Inventory Gold: <span id="bank-player-gold" class="gold-indicator">0</span> GP</div>
                <div>Bank Gold: <span id="bank-gold" class="gold-indicator">0</span> GP</div>
                <input type="number" id="bank-gold-amount" min="1" placeholder="Amount">
                <button id="bank-deposit-gold-button">Deposit</button> <button id="bank-withdraw-gold-button">Withdraw</button> <button id="bank-deposit-all-gold-button">Deposit All</button>
            </div>
        </div>
        <!-- Log is persistent -->`;

    addSafeListener(document.getElementById('bank-deposit-gold-button'), 'click', depositGold, 'bankDepositGoldButton');
    addSafeListener(document.getElementById('bank-withdraw-gold-button'), 'click', withdrawGold, 'bankWithdrawGoldButton');
    addSafeListener(document.getElementById('bank-deposit-all-gold-button'), 'click', depositAllGold, 'bankDepositAllGoldButton');
    addSafeListener(document.getElementById('bank-inventory-grid'), 'contextmenu', handleContextMenuClick, 'bankInvGridContextMenu');
    addSafeListener(document.getElementById('bank-grid'), 'contextmenu', handleContextMenuClick, 'bankGridContextMenu');

    updateBankDisplay();
}

function showShopView() {
    clearMainContent();
    setActiveNavLink('nav-shop');
    currentView = 'shop';
    if (!mainContent) return;

    mainContent.innerHTML = `
        <h2 class="page-header">General Store</h2>
        <div class="content-panel shop-section"><h3>Stock</h3><ul id="shop-stock-list"></ul></div>
        <div class="content-panel shop-section"><h3>Your Inventory (Sell Actions)</h3><ul id="shop-inventory-list"></ul></div>
        <div class="content-panel shop-gold-display">Your Gold: <span id="shop-player-gold" class="gold-indicator">0</span> GP</div>
        <!-- Log is persistent -->`;

    updateShopDisplay();
}

function showSettingsView() {
    clearMainContent();
    setActiveNavLink('nav-settings');
    currentView = 'settings';
    if (!mainContent) return;

    mainContent.innerHTML = `
        <h2 class="page-header">Settings</h2>
        <div class="content-panel">
            <div class="setting-option"><label for="theme-select">Theme:</label><select id="theme-select"></select><span id="current-theme-label">Current: ${themes[gameState.persistent.settings.theme] || 'Unknown'}</span></div>
        </div>
        <!-- Log is persistent -->`;

    const themeSelect = document.getElementById('theme-select');
    populateThemeSelector();
    addSafeListener(themeSelect, 'change', (event) => { applyTheme(event.target.value); }, 'themeSelectChange');
}


function setupUI() {
    console.log("--- setupUI() called ---");
    let setupOk = true;

    // --- DOM Element References ---
    sidebar = document.getElementById('sidebar');
    mainContent = document.getElementById('main-content');
    headerGoldDisplay = document.getElementById('player-gold'); // Use direct ID
    skillsNavListEl = document.getElementById('skills-nav-list');
    logContentEl = document.getElementById('log-content-persistent');
    sellXModal = document.getElementById('sell-x-modal'); sellXCloseBtn = document.getElementById('sell-x-close-button'); sellXConfirmBtn = document.getElementById('sell-x-confirm-button'); sellXCancelBtn = document.getElementById('sell-x-cancel-button');
    contextMenuEl = document.getElementById('context-menu');
    devPanel = document.getElementById('dev-panel'); devCloseButton = document.getElementById('dev-close-button');
    // Dev panel internal refs (check for existence)
    sellXItemNameEl = document.getElementById('sell-x-item-name'); sellXMaxQtyEl = document.getElementById('sell-x-max-qty'); sellXQtyInput = document.getElementById('sell-x-quantity-input'); sellXErrorEl = document.getElementById('sell-x-error');
    devSkillSelect = document.getElementById('dev-skill-select'); devLevelInput = document.getElementById('dev-level-input'); devSetLevelButton = document.getElementById('dev-set-level-button'); devItemSelect = document.getElementById('dev-item-select'); devItemQuantityInput = document.getElementById('dev-item-quantity'); devGiveItemButton = document.getElementById('dev-give-item-button'); devResetSaveButton = document.getElementById('dev-reset-save-button');


    if (!sidebar || !mainContent || !headerGoldDisplay || !skillsNavListEl || !logContentEl || !contextMenuEl || !devPanel || !sellXModal) {
        console.error("setupUI FATAL: Missing one or more critical elements!");
        setupOk = false;
    }
    // Warn if optional elements missing
    if (!devCloseButton) console.warn("setupUI Warn: Dev close button not found.");
    if (!devSkillSelect) console.warn("setupUI Warn: Dev skill select not found.");
    // ... more warnings ...

    if (!setupOk) {
        console.error("FATAL: setupUI failed due to missing critical elements. Aborting.");
        return false;
    }

    // --- Add Event Listeners (Using addSafeListener) ---
    addSafeListener(document.getElementById('nav-inventory'), 'click', (e) => { e.preventDefault(); showInventoryView(); }, 'nav-inventory');
    addSafeListener(document.getElementById('nav-skills-main'), 'click', (e) => { e.preventDefault(); showSkillsView(); }, 'nav-skills-main');
    addSafeListener(document.getElementById('nav-bank'), 'click', (e) => { e.preventDefault(); showBankView(); }, 'nav-bank');
    addSafeListener(document.getElementById('nav-shop'), 'click', (e) => { e.preventDefault(); showShopView(); }, 'nav-shop');
    addSafeListener(document.getElementById('nav-settings'), 'click', (e) => { e.preventDefault(); showSettingsView(); }, 'nav-settings');
    addSafeListener(document.getElementById('nav-dev-panel-toggle'), 'click', (e) => { e.preventDefault(); toggleDevPanel(); }, 'nav-dev-panel-toggle');

    addSafeListener(sellXCloseBtn, 'click', closeSellXModal, 'sellXCloseBtn');
    addSafeListener(devCloseButton, 'click', toggleDevPanel, 'devCloseButton');
    addSafeListener(sellXConfirmBtn, 'click', confirmSellX, 'sellXConfirmBtn');
    addSafeListener(sellXCancelBtn, 'click', closeSellXModal, 'sellXCancelBtn');
    addSafeListener(devSetLevelButton, 'click', () => { if (devSkillSelect && devLevelInput && typeof window.devSetSkillLevel === 'function') window.devSetSkillLevel(devSkillSelect.value, parseInt(devLevelInput.value || 1)); }, 'devSetLevelButton');
    addSafeListener(devGiveItemButton, 'click', () => { if (devItemSelect && devItemQuantityInput && typeof window.devGiveItem === 'function') window.devGiveItem(devItemSelect.value, parseInt(devItemQuantityInput.value || 1)); }, 'devGiveItemButton');
    addSafeListener(devResetSaveButton, 'click', resetGameData, 'devResetSaveButton');

    // --- Populate Dynamic UI ---
    populateSkillNav(); // Attaches listeners internally
    // Populate Dev Panel dropdowns only if elements exist
    if (devSkillSelect && typeof gameState === 'object' && gameState.persistent?.skills) { devSkillSelect.innerHTML = ''; Object.keys(gameState.persistent.skills).forEach(skillId => { const option = document.createElement('option'); option.value = skillId; option.textContent = skillId.charAt(0).toUpperCase() + skillId.slice(1); devSkillSelect.appendChild(option); }); }
    if (devItemSelect && typeof itemData === 'object' && itemData !== null) { devItemSelect.innerHTML = ''; Object.keys(itemData).sort((a, b) => (itemData[a]?.name || a).localeCompare(itemData[b]?.name || b)).forEach(id => { const option = document.createElement('option'); option.value = id; option.textContent = itemData[id]?.name || id; devItemSelect.appendChild(option); }); } else { console.warn("setupUI: Could not populate dev item select."); }

    // --- Global Listeners ---
    // Context menu listener attached dynamically in view functions using addSafeListener
    document.removeEventListener("click", handleGlobalLeftClick); // Remove old listener if exists
    document.addEventListener('click', handleGlobalLeftClick); // Re-add global listener for simplicity in this version
    if (contextMenuEl) {
        if (contextMenuEl._mouseleaveHandler) contextMenuEl.removeEventListener('mouseleave', contextMenuEl._mouseleaveHandler);
        contextMenuEl._mouseleaveHandler = hideContextMenu;
        contextMenuEl.addEventListener('mouseleave', contextMenuEl._mouseleaveHandler);
    } else {
        console.warn("setupUI Warn: Context menu element not found for mouseleave listener.");
    }


    // --- Initial State ---
    applyTheme(gameState.persistent.settings.theme || 'dark'); // Apply theme early
    showInventoryView(); // Show default view on load

    console.log("--- setupUI() finished ---");
    return true;
} // End of setupUI function

// --- logMessage FUNCTION ---
function logMessage(message, type = 'normal') {
    if (!logContentEl) { // Use the global logContentEl
        logContentEl = document.getElementById('log-content-persistent');
        if (!logContentEl) { console.error("CRITICAL: logContentEl not found. Message lost:", message); return; }
    }
    const p = document.createElement('p'); p.textContent = message; p.className = `log-${type}`; logContentEl.appendChild(p);
    requestAnimationFrame(() => { if (logContentEl) { logContentEl.scrollTop = logContentEl.scrollHeight; } });
} // End of logMessage function

console.log("ui.js loaded.");

// <<<--- END OF COMPLETE ui.js SCRIPT ---