// SPDX-License-Identifier: MPL-2.0
// SPDX-FileCopyrightText: 2020 Brandon Streiff

"use strict";

function saveOptions(e) {
  var prefsItem = browser.storage.local.get("preferences");

  prefsItem.then((res) => {
    let prefs = res.preferences;

    prefs.inboxOnly = document.querySelector("#inboxOnly").checked;
    prefs.badgeStyle = document.querySelector("#badgeStyle").value;
    prefs.includeDrafts = document.querySelector("#includeDrafts").checked;
    prefs.includeJunk = document.querySelector("#includeJunk").checked;
    prefs.includeSent = document.querySelector("#includeSent").checked;
    prefs.includeTrash = document.querySelector("#includeTrash").checked;

    browser.storage.local.set({ preferences: prefs });
  });

  e.preventDefault();
}

function restoreOptions() {
  let prefsItem = browser.storage.local.get("preferences");

  prefsItem.then((res) => {
    let prefs = res.preferences;
    document.querySelector("#inboxOnly").checked = prefs.inboxOnly;
    document.querySelector("#badgeStyle").value = prefs.badgeStyle;
    document.querySelector("#includeDrafts").checked = prefs.includeDrafts;
    document.querySelector("#includeJunk").checked = prefs.includeJunk;
    document.querySelector("#includeSent").checked = prefs.includeSent;
    document.querySelector("#includeTrash").checked = prefs.includeTrash;
  });

  document.querySelector("form").addEventListener("submit", saveOptions);
}

document.addEventListener("DOMContentLoaded", restoreOptions);
