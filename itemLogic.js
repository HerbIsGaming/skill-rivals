// --- START OF FILE itemLogic.js ---

// --- Item, Inventory, Bank, Shop Logic ---

// Find the first empty slot index in an inventory array, or -1 if full
function findEmptyInventorySlot(inventory = window.gameState?.persistent?.inventory, slotLimit = MAX_INV_SLOTS) {
    if (!inventory) return -1;
    for (let i = 0; i < slotLimit; i++) {
        if (!inventory[i]) {
            return i;
        }
    }
    return -1; // Not found
}

// Find the index of the first slot containing the specified item ID with space available
function findPartialStack(itemId, inventory = window.gameState?.persistent?.inventory, slotLimit = MAX_INV_SLOTS) {
    if (!inventory || !window.itemData) return -1;
    const itemInfo = window.itemData[itemId];
    if (!itemInfo || itemInfo.stackLimit <= 1) return -1; // Not stackable or invalid item

    for (let i = 0; i < slotLimit; i++) {
        const slot = inventory[i];
        if (slot && slot.id === itemId && slot.quantity < itemInfo.stackLimit) {
            return i;
        }
    }
    return -1; // Not found
}

// Adds an item to a specified inventory array (handles stacking)
// Returns true if *all* quantity was added, false otherwise.
function addItemToInventory(itemId, quantity = 1, targetInventory = window.gameState?.persistent?.inventory, slotLimit = MAX_INV_SLOTS) {
    // console.log(`addItemToInventory: Attempting to add ${quantity}x '${itemId}' to inventory (limit ${slotLimit})`);
    if (!window.itemData || !window.gameState) { console.error("addItemToInventory: Missing global data!"); return false; }
    const itemInfo = window.itemData[itemId];
    if (!itemInfo) { console.error(`addItemToInventory Error: Unknown item ID: ${itemId}`); return false; }
    if (!targetInventory || !Array.isArray(targetInventory)) { console.error(`addItemToInventory Error: Invalid target inventory provided.`); return false; }

    let remainingQuantity = quantity;

    // 1. Try stacking
    if (itemInfo.stackLimit > 1) {
        let partialStackIndex;
        while (remainingQuantity > 0 && (partialStackIndex = findPartialStack(itemId, targetInventory, slotLimit)) !== -1) {
            const slot = targetInventory[partialStackIndex];
            const canAdd = itemInfo.stackLimit - slot.quantity;
            const amountToAdd = Math.min(remainingQuantity, canAdd);
            // console.log(`addItemToInventory: Stacking ${amountToAdd} onto slot ${partialStackIndex} (current: ${slot.quantity}, limit: ${itemInfo.stackLimit})`);
            slot.quantity += amountToAdd;
            remainingQuantity -= amountToAdd;
        }
    }

    // 2. Try adding to empty slots
    while (remainingQuantity > 0) {
        const emptySlotIndex = findEmptyInventorySlot(targetInventory, slotLimit);
        if (emptySlotIndex === -1) {
            const inventoryName = (targetInventory === gameState.persistent.inventory) ? "Inventory" : "Bank"; // Determine target for message
            console.warn(`addItemToInventory Warn: ${inventoryName} full. Cannot add remaining ${remainingQuantity}x ${itemInfo.name}.`);
            const logFn = typeof logMessage === 'function' ? logMessage : logMessageFallback;
            logFn(`${inventoryName} full. Cannot add remaining ${remainingQuantity}x ${itemInfo.name}.`, "warn");
            // Return true IF some were added before running out of space, false if NONE could be added.
            return quantity > remainingQuantity;
        }
        const amountToAdd = Math.min(remainingQuantity, itemInfo.stackLimit);
        // console.log(`addItemToInventory: Adding ${amountToAdd} to new slot ${emptySlotIndex}`);
        targetInventory[emptySlotIndex] = { id: itemId, quantity: amountToAdd };
        remainingQuantity -= amountToAdd;
    }

    // console.log(`addItemToInventory: Successfully added all ${quantity}x '${itemId}'`);
    return true; // All items were added successfully
} // End of addItemToInventory

// Convenience function to add item to player's main inventory
function addItem(itemId, quantity = 1) {
    const success = addItemToInventory(itemId, quantity, gameState.persistent.inventory, MAX_INV_SLOTS);
    // UI Updates happen via updateAllDisplays called from calling function
    return success;
}

// Removes a specific quantity of an item from an inventory array.
// Returns true if the *exact* quantity was successfully removed, false otherwise.
function removeItemFromInventory(itemId, quantity = 1, sourceInventory = window.gameState?.persistent?.inventory, slotLimit = MAX_INV_SLOTS) {
    if (!sourceInventory || !Array.isArray(sourceInventory)) {
        console.error("removeItemFromInventory Error: Invalid source inventory provided.");
        return false;
    }
    let foundQuantity = 0;
    let slotsToRemoveFrom = [];

    // First pass: Find all slots with the item and total quantity
    for (let i = 0; i < slotLimit; i++) {
        const slot = sourceInventory[i];
        if (slot && slot.id === itemId) {
            foundQuantity += slot.quantity;
            slotsToRemoveFrom.push({ index: i, quantity: slot.quantity });
        }
    }

    // Check if enough exists across all stacks
    if (foundQuantity < quantity) {
        // console.warn(`removeItemFromInventory: Cannot remove ${quantity}x ${itemId}. Only found ${foundQuantity}.`); // Usually handled by caller
        return false; // Not enough found
    }

    // Second pass: Remove items from slots, starting from the first found slot.
    let remainingToRemove = quantity;
    slotsToRemoveFrom.sort((a, b) => a.index - b.index); // Process in slot order for consistency

    for (const slotInfo of slotsToRemoveFrom) {
        if (remainingToRemove <= 0) break; // Stop if we've removed enough

        const slot = sourceInventory[slotInfo.index];
        // Double-check slot still exists and has the correct item
        if (!slot || slot.id !== itemId) {
            console.warn(`removeItemFromInventory Warning: Slot ${slotInfo.index} changed during removal process. Skipping.`);
            continue; // Skip this slot if it somehow changed
        }

        const amountToRemoveFromSlot = Math.min(remainingToRemove, slot.quantity);
        slot.quantity -= amountToRemoveFromSlot;
        remainingToRemove -= amountToRemoveFromSlot;

        if (slot.quantity <= 0) {
            sourceInventory[slotInfo.index] = null; // Clear the slot if empty
        }
    }

    // Safety check
    if (remainingToRemove > 0) {
        console.error(`removeItemFromInventory Error: Mismatch after removing ${itemId}. ${remainingToRemove} still needed. This indicates a logic error or concurrent modification.`);
        // Attempt potential recovery or just report error. For now, report.
        return false;
    }

    return true; // Successfully removed exact quantity
} // End of removeItemFromInventory

// Convenience function to remove item from player's main inventory
function removeItem(itemId, quantity = 1) {
    const success = removeItemFromInventory(itemId, quantity, gameState.persistent.inventory, MAX_INV_SLOTS);
    // UI update handled by calling function via updateAllDisplays
    return success;
}

// Equip an item
function equipItem(itemId) {
    const item = window.itemData[itemId];
    if (!item || item.type !== 'equipment' || !item.slot) {
        logMessage("That item cannot be equipped.", "warn");
        return;
    }
    if (!window.gameState?.persistent?.equipment) {
        console.error("equipItem Error: Missing equipment state.");
        return;
    }

    // Check requirements
    if (!checkRequirements(item.requirements)) {
        logMessage(`You do not meet the requirements to equip ${item.name}.`, "error");
        return;
    }

    const currentEquip = gameState.persistent.equipment[item.slot];
    let previouslyEquippedItemId = null; // Store the ID, not the slot object

    // Find the item in inventory
    let itemInvIndex = -1;
    for (let i = 0; i < MAX_INV_SLOTS; i++) {
        if (gameState.persistent.inventory[i]?.id === itemId) {
            itemInvIndex = i;
            break;
        }
    }
    if (itemInvIndex === -1) {
        logMessage(`Cannot find ${item.name} in inventory to equip.`, "error"); // Should not happen if called correctly
        return;
    }

    // Check if something is already equipped in that slot
    if (currentEquip) {
        previouslyEquippedItemId = currentEquip; // Store the ID of the item to unequip
    }

    // Remove the item being equipped from the inventory
    if (!removeItem(itemId, 1)) {
        logMessage(`Error removing ${item.name} from inventory during equip.`, "error");
        return; // Failed to remove item, abort equip
    }


    // Equip the new item
    gameState.persistent.equipment[item.slot] = itemId;
    logMessage(`Equipped ${item.name}.`, "info");

    // If an item was previously equipped, add it back to the inventory
    if (previouslyEquippedItemId) {
        if (!addItem(previouslyEquippedItemId, 1)) {
            // This is tricky - item equipped, old item couldn't be added back.
            // Log error and notify player the old item is lost.
            const oldItemNameFormatted = window.itemData[previouslyEquippedItemId]?.name || previouslyEquippedItemId;
            logMessage(`Warning: Could not add unequipped item (${oldItemNameFormatted}) back to inventory (full?). It is lost.`, "warn");
        } else {
            const oldItemName = window.itemData[previouslyEquippedItemId]?.name || previouslyEquippedItemId;
            logMessage(`Unequipped ${oldItemName}.`, "info");
        }
    }

    updateAllDisplays(); // Update UI
    updateActionButtonsState(); // Re-check requirements for actions
}

// Drops the *entire stack* from the specified inventory slot.
function dropItem(inventoryIndex) {
    if (!window.gameState?.persistent?.inventory) return;
    const slot = gameState.persistent.inventory[inventoryIndex];
    if (!slot) {
        console.warn(`dropItem: Attempted to drop empty slot ${inventoryIndex}`);
        return; // Nothing to drop
    }

    const itemName = window.itemData[slot.id]?.name || slot.id;
    const quantityDropped = slot.quantity;

    // Clear the slot directly
    gameState.persistent.inventory[inventoryIndex] = null;

    logMessage(`Dropped ${quantityDropped > 1 ? quantityDropped.toLocaleString() + 'x ' : ''}${itemName}.`, "info");
    updateAllDisplays(); // Update inventory UI
}

// Deposit one item from inventory index to bank
function depositItemOne(invIdx) {
    if (!window.gameState?.persistent) return;
    const playerInventory = gameState.persistent.inventory;
    const bankInventory = gameState.persistent.bankInventory;
    const slot = playerInventory[invIdx];

    if (!slot) { console.warn("depositItemOne: Slot is empty."); return; }

    // 1. Attempt to add ONE item to the bank
    if (addItemToInventory(slot.id, 1, bankInventory, MAX_BANK_SLOTS)) {
        // 2. If successful, remove ONE item from the player's inventory
        if (removeItemFromInventory(slot.id, 1, playerInventory, MAX_INV_SLOTS)) {
            const itemName = window.itemData[slot.id]?.name || slot.id;
            logMessage(`Deposited 1x ${itemName}.`, "info");
            updateAllDisplays(); // Update both bank and inventory UI
        } else {
            console.error("depositItemOne: Added to bank but failed to remove from inventory! State might be inconsistent.");
            removeItemFromInventory(slot.id, 1, bankInventory, MAX_BANK_SLOTS); // Try to remove it back
            logMessage(`Deposit failed: Error removing from inventory. Attempted to revert bank deposit.`, "error");
            updateAllDisplays(); // Update UI again after potential revert
        }
    } else {
        // Bank was full or couldn't stack, addItemToInventory already logged the reason.
    }
}

// Deposit the entire stack from inventory index to bank
function depositItemStack(invIdx) {
    if (!window.gameState?.persistent) return;
    const playerInventory = gameState.persistent.inventory;
    const bankInventory = gameState.persistent.bankInventory;
    const slot = playerInventory[invIdx];

    if (!slot) { console.warn("depositItemStack: Slot is empty."); return; }

    const itemId = slot.id;
    const quantityToDeposit = slot.quantity;
    const itemName = window.itemData[itemId]?.name || itemId;

    // 1. Attempt to add the WHOLE stack to the bank
    if (addItemToInventory(itemId, quantityToDeposit, bankInventory, MAX_BANK_SLOTS)) {
        // 2. If successful, remove the WHOLE stack from the player's inventory
        // We know the item and quantity exist because we just read them from the slot.
        // Clearing the slot directly is safe and efficient here.
        playerInventory[invIdx] = null;
        logMessage(`Deposited ${quantityToDeposit.toLocaleString()}x ${itemName}.`, "info");
        updateAllDisplays(); // Update both bank and inventory UI
    } else {
        // Bank was full or couldn't stack, addItemToInventory already logged the reason.
    }
}


// Withdraw one item from bank index to inventory
function withdrawItem(bankIdx) {
    if (!window.gameState?.persistent) return;
    const playerInventory = gameState.persistent.inventory;
    const bankInventory = gameState.persistent.bankInventory;
    const slot = bankInventory[bankIdx];

    if (!slot) { console.warn("withdrawItem: Bank slot is empty."); return; }

    // 1. Attempt to add ONE item to the player's inventory
    if (addItemToInventory(slot.id, 1, playerInventory, MAX_INV_SLOTS)) {
        // 2. If successful, remove ONE item from the bank inventory
        if (removeItemFromInventory(slot.id, 1, bankInventory, MAX_BANK_SLOTS)) {
            const itemName = window.itemData[slot.id]?.name || slot.id;
            logMessage(`Withdrew 1x ${itemName}.`, "info");
            updateAllDisplays(); // Update both bank and inventory UI
        } else {
            console.error("withdrawItem: Added to inventory but failed to remove from bank! State might be inconsistent.");
            removeItemFromInventory(slot.id, 1, playerInventory, MAX_INV_SLOTS); // Try to remove it back
            logMessage(`Withdraw failed: Error removing from bank. Attempted to revert inventory addition.`, "error");
            updateAllDisplays();
        }
    } else {
        // Player inventory full
        const logFn = typeof logMessage === 'function' ? logMessage : logMessageFallback;
        const itemName = window.itemData[slot.id]?.name || slot.id;
        logFn(`Cannot withdraw ${itemName}: Inventory full.`, "warn");
    }
}

// Withdraw the entire stack from bank index to inventory
function withdrawItemStack(bankIdx) {
    if (!window.gameState?.persistent) return;
    const playerInventory = gameState.persistent.inventory;
    const bankInventory = gameState.persistent.bankInventory;
    const slot = bankInventory[bankIdx];

    if (!slot) { console.warn("withdrawItemStack: Bank slot is empty."); return; }

    const itemId = slot.id;
    const quantityToWithdraw = slot.quantity;
    const itemName = window.itemData[itemId]?.name || itemId;

    // 1. Attempt to add the WHOLE stack to the player's inventory
    if (addItemToInventory(itemId, quantityToWithdraw, playerInventory, MAX_INV_SLOTS)) {
        // 2. If successful, remove the WHOLE stack from the bank inventory
        bankInventory[bankIdx] = null; // Safe to clear directly
        logMessage(`Withdrew ${quantityToWithdraw.toLocaleString()}x ${itemName}.`, "info");
        updateAllDisplays(); // Update both bank and inventory UI
    } else {
        // Player inventory full
        const logFn = typeof logMessage === 'function' ? logMessage : logMessageFallback;
        logFn(`Cannot withdraw ${quantityToWithdraw.toLocaleString()}x ${itemName}: Inventory full.`, "warn");
    }
}

// Deposit gold from player to bank
function depositGold() {
    if (!window.gameState?.persistent) return;
    const inputEl = document.getElementById('bank-gold-amount');
    if (!inputEl) return;
    const amount = parseInt(inputEl.value);

    if (isNaN(amount) || amount <= 0) {
        logMessage("Please enter a valid amount of gold to deposit.", "warn");
        return;
    }
    if (amount > gameState.persistent.gold) {
        logMessage("You don't have that much gold to deposit.", "warn");
        return;
    }

    gameState.persistent.gold -= amount;
    gameState.persistent.bankGold += amount;
    inputEl.value = ''; // Clear input
    logMessage(`Deposited ${amount.toLocaleString()} GP into your bank.`, "info");
    updateAllDisplays(); // Update gold displays
}

// Withdraw gold from bank to player
function withdrawGold() {
    if (!window.gameState?.persistent) return;
    const inputEl = document.getElementById('bank-gold-amount');
    if (!inputEl) return;
    const amount = parseInt(inputEl.value);

    if (isNaN(amount) || amount <= 0) {
        logMessage("Please enter a valid amount of gold to withdraw.", "warn");
        return;
    }
    if (amount > gameState.persistent.bankGold) {
        logMessage("You don't have that much gold in your bank.", "warn");
        return;
    }

    gameState.persistent.bankGold -= amount;
    gameState.persistent.gold += amount;
    inputEl.value = ''; // Clear input
    logMessage(`Withdrew ${amount.toLocaleString()} GP from your bank.`, "info");
    updateAllDisplays(); // Update gold displays
}

// Deposit all player gold into bank
function depositAllGold() {
    if (!window.gameState?.persistent) return;
    const amount = gameState.persistent.gold;
    if (amount <= 0) {
        logMessage("You have no gold to deposit.", "info");
        return;
    }
    gameState.persistent.gold = 0;
    gameState.persistent.bankGold += amount;
    logMessage(`Deposited all ${amount.toLocaleString()} GP into your bank.`, "info");
    updateAllDisplays(); // Update gold displays
}

// --- buyItem ---
function buyItem(itemId) {
    if (!window.gameState || !window.itemData || !window.SHOP_STOCK) {
        console.error("buyItem Error: Missing global data!");
        return;
    }
    const item = window.itemData[itemId];
    const stockInfo = window.SHOP_STOCK[itemId];

    if (!item) {
        console.error(`buyItem Error: Unknown item ID '${itemId}' in itemData.`);
        return;
    }

    if (stockInfo === undefined) {
        logMessage("This item is not sold here.", "warn");
        return;
    }
    if (stockInfo <= 0 && stockInfo !== Infinity) {
        logMessage("This item is out of stock.", "warn");
        return;
    }

    if (!item.buyPrice || item.buyPrice <= 0) {
        logMessage("This item cannot be bought.", "warn");
        return;
    }

    const currentGold = gameState.persistent.gold;
    if (currentGold < item.buyPrice) {
        logMessage("You don't have enough gold.", "error");
        return;
    }

    // Attempt to add the item first
    if (addItem(itemId, 1)) {
        // Only subtract gold *after* successfully adding the item
        gameState.persistent.gold -= item.buyPrice;
        logMessage(`Bought ${item.name} for ${item.buyPrice.toLocaleString()} GP.`, "info");
        // If stock was finite, decrement it here: if (stockInfo !== Infinity) window.SHOP_STOCK[itemId]--;
        updateAllDisplays(); // Update inventory, gold, potentially shop stock
    } else {
        // addItem already logs the "inventory full" message if that's the cause.
    }
}

// Sell one item from the specified inventory index
function sellItem(invIdx) {
    // Call the quantity function with 1
    sellItemQuantity(invIdx, 1);
}

// Sell a specific quantity of an item from an inventory index
function sellItemQuantity(invIdx, quantity) {
    if (!window.gameState || !window.itemData || !gameState.persistent.inventory) return;
    const slot = gameState.persistent.inventory[invIdx];

    if (!slot) { console.warn(`sellItemQuantity: No item in slot ${invIdx}.`); return; }
    if (quantity <= 0) { console.warn(`sellItemQuantity: Invalid quantity ${quantity}.`); return; }
    if (quantity > slot.quantity) { logMessage(`You don't have ${quantity.toLocaleString()} of that item to sell.`, "warn"); return; }

    const item = window.itemData[slot.id];
    if (!item) { console.error(`sellItemQuantity: Unknown item ID ${slot.id} in slot ${invIdx}.`); return; }

    // Calculate sell price (using existing logic)
    let sellValue = 0;
    if (typeof item.sellPrice === 'number' && item.sellPrice > 0) {
        sellValue = item.sellPrice;
    } else if (item.buyPrice && item.buyPrice > 0) {
        sellValue = Math.max(1, Math.floor(item.buyPrice * (gameState.transient.config.sellPriceRatio || 0.25))); // Use default 0.25 if config missing
    }

    if (sellValue <= 0) {
        logMessage(`You cannot sell ${item.name}.`, "warn");
        return;
    }

    const totalGain = sellValue * quantity;

    // Attempt to remove the items first
    if (removeItem(slot.id, quantity)) {
        // Only add gold *after* successfully removing the items
        gameState.persistent.gold += totalGain;
        logMessage(`Sold ${quantity.toLocaleString()}x ${item.name} for ${totalGain.toLocaleString()} GP.`, "info");
        updateAllDisplays(); // Update inventory, gold
    } else {
        // removeItem should ideally only fail if not enough exist, but we checked that.
        // This might indicate a bug in removeItemFromInventory if it occurs.
        logMessage(`Failed to remove ${item.name} from inventory during sell.`, "error");
    }
}

// Sell the entire stack from the specified inventory index
function sellItemAll(invIdx) {
    if (!window.gameState || !window.gameState.persistent.inventory) return;
    const slot = gameState.persistent.inventory[invIdx];
    if (!slot) { console.warn(`sellItemAll: No item in slot ${invIdx}.`); return; }

    // Call the quantity function with the full stack amount
    sellItemQuantity(invIdx, slot.quantity);
}


console.log("itemLogic.js loaded.");