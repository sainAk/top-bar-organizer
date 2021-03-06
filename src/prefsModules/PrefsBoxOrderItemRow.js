/*
 * This file is part of Top-Bar-Organizer (a Gnome Shell Extension for
 * organizing your Gnome Shell top bar).
 * Copyright (C) 2021 Julian Schacher
 *
 * Top-Bar-Organizer is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
/* exported PrefsBoxOrderItemRow */
"use strict";

const Gtk = imports.gi.Gtk;
const Gdk = imports.gi.Gdk;
const Gio = imports.gi.Gio;
const GObject = imports.gi.GObject;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

var PrefsBoxOrderItemRow = GObject.registerClass({
    GTypeName: "PrefsBoxOrderItemRow",
    Template: Me.dir.get_child("prefs-box-order-item-row.ui").get_uri(),
    InternalChildren: [
        "item-name-display-label",
        "menu-button"
    ]
}, class PrefsBoxOrderItemRow extends Gtk.ListBoxRow {
    _init(params = {}, scrollManager, item) {
        super._init(params);

        this._associateItem(item);
        this._configureMenu();

        // Make `this` draggable by creating a drag source and adding it to
        // `this`.
        let dragSource = new Gtk.DragSource();
        dragSource.set_actions(Gdk.DragAction.MOVE);
        dragSource.connect("prepare", () => {
            return Gdk.ContentProvider.new_for_value(this);
        });
        // Stop all scrolling, which is due to this DND operation.
        dragSource.connect("drag-end", () => {
            scrollManager.stopScrollAll();
        });
        this.add_controller(dragSource);

        /// Make `this` accept drops by creating a drop target and adding it to
        /// `this`.
        let dropTarget = new Gtk.DropTarget();
        dropTarget.set_gtypes([this.constructor.$gtype]);
        dropTarget.set_actions(Gdk.DragAction.MOVE);
        // Handle a new drop on `this` properly.
        // `value` is the thing getting dropped.
        dropTarget.connect("drop", (target, value) => {
            // If `this` got dropped onto itself, do nothing.
            if (value === this) {
                return;
            }

            // Get the GtkListBoxes of `this` and the drop value.
            const ownListBox = this.get_parent();
            const valueListBox = value.get_parent();

            // Get the position of `this` and the drop value.
            const ownPosition = this.get_index();
            const valuePosition = value.get_index();

            // Remove the drop value from its list box.
            valueListBox.remove(value);

            // Since an element got potentially removed from the list of `this`,
            // get the position of `this` again.
            const updatedOwnPosition = this.get_index();

            if (ownListBox !== valueListBox) {
                // First handle the case where `this` and the drop value are in
                // different list boxes.
                if ((ownListBox.boxOrder === "right-box-order" && valueListBox.boxOrder === "left-box-order")
                    || (ownListBox.boxOrder === "right-box-order" && valueListBox.boxOrder === "center-box-order")
                    || (ownListBox.boxOrder === "center-box-order" && valueListBox.boxOrder === "left-box-order")) {
                    // If the list box of the drop value comes before the list
                    // box of `this`, add the drop value after `this`.
                    ownListBox.insert(value, updatedOwnPosition + 1);
                } else {
                    // Otherwise, add the drop value where `this` currently is.
                    ownListBox.insert(value, updatedOwnPosition);
                }
            } else {
                if (valuePosition < ownPosition) {
                    // If the drop value was before `this`, add the drop value
                    // after `this`.
                    ownListBox.insert(value, updatedOwnPosition + 1);
                } else {
                    // Otherwise, add the drop value where `this` currently is.
                    ownListBox.insert(value, updatedOwnPosition);
                }
            }

            /// Finally save the box order(/s) to settings.
            ownListBox.saveBoxOrderToSettings();
            // If the list boxes of `this` and the drop value were different,
            // save an updated box order for the list were the drop value was in
            // as well.
            if (ownListBox !== valueListBox) valueListBox.saveBoxOrderToSettings();
        });
        this.add_controller(dropTarget);
    }

    /**
     * Associate `this` with an item.
     * @param {String} item
     */
    _associateItem(item) {
        this.item = item;

        // Set `this._item_name_display_label` to something nicer, if the
        // associated item is an AppIndicator/KStatusNotifierItem item.
        if (item.startsWith("appindicator-kstatusnotifieritem-")) this._item_name_display_label.set_label(item.replace("appindicator-kstatusnotifieritem-", ""));
        // Otherwise just set it to `item`.
        else this._item_name_display_label.set_label(item);
    }

    /**
     * Configure the menu.
     */
    _configureMenu() {
        let menu = new Gio.Menu();
        menu.append("Forget", `prefsBoxOrderItemRow-${this.item}.forget`);
        this._menu_button.set_menu_model(menu);

        const forgetAction = new Gio.SimpleAction({ name: "forget" });
        forgetAction.connect("activate", () => {
            const parentListBox = this.get_parent();
            parentListBox.remove(this);
            parentListBox.saveBoxOrderToSettings();
        });

        const actionGroup = new Gio.SimpleActionGroup();
        actionGroup.add_action(forgetAction);
        this.insert_action_group(`prefsBoxOrderItemRow-${this.item}`, actionGroup);
    }
});
