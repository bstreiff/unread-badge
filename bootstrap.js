/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 * Credit also goes to:
 *   https://github.com/sid0/overlay-extension/blob/master/bootstrap.js
 *   https://github.com/lpiepiora/docky-thunderbird/blob/master/src/chrome/content/dockyunread.js
 * for helping me figure out how to make this all come together.
 */

'use strict';

if (!net) var net = {};
if (!net.streiff) net.streiff = {};

net.streiff.unreadbadge = function ()
{
   const Cc = Components.classes;
   const Ci = Components.interfaces;

   /* See https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsMsgFolderFlagType
   for what all of these mean.
    */
   const nsMsgFolderFlags = Ci.nsMsgFolderFlags;

   const prefsPrefix = "extensions.unreadbadge.";
   const defaultPrefs =
   {
      "badgeColor" : "#FF0000",
      "textColor" : "#FFFFFF",
      "ignoreJunk" : true,
      "ignoreDrafts" : true,
      "ignoreTrash" : true,
      "ignoreSent" : true,
      "inboxOnly" : false
   };

   Components.utils.import("resource://gre/modules/Services.jsm");
   Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
   Components.utils.import("resource://gre/modules/NetUtil.jsm");
   
   var xpc = {};

   XPCOMUtils.defineLazyServiceGetter(xpc, "imgTools", "@mozilla.org/image/tools;1", "imgITools");
   XPCOMUtils.defineLazyServiceGetter(xpc, "taskbar", "@mozilla.org/windows-taskbar;1", "nsIWinTaskbar");
   XPCOMUtils.defineLazyServiceGetter(xpc, "acctMgr", "@mozilla.org/messenger/account-manager;1", "nsIMsgAccountManager");
   XPCOMUtils.defineLazyServiceGetter(xpc, "mailSession", "@mozilla.org/messenger/services/session;1", "nsIMsgMailSession");
   XPCOMUtils.defineLazyServiceGetter(xpc, "notificationService", "@mozilla.org/messenger/msgnotificationservice;1", "nsIMsgFolderNotificationService");

   var setDefaultPreferences = function ()
   {
      let prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService);
      let branch = prefs.getDefaultBranch(prefsPrefix);
      for (let key in defaultPrefs) {
         if (defaultPrefs.hasOwnProperty(key)) {
            let value = defaultPrefs[key];
            if (typeof value == "boolean")
               branch.setBoolPref(key, value);
            else if (typeof value == "number")
               branch.setIntPref(key, value);
            else if (typeof value == "string")
               branch.setCharPref(key, value);
         }
      }
   }

   var decodeImageToPng = function (imgEncoder)
   {
      if (xpc.imgTools.decodeImage)
      {
         /* Thunderbird < 60 */
         return xpc.imgTools.decodeImage(imgEncoder, "image/png");
      }
      else
      {
         /* Thunderbird 60+ */
         let imgBuffer = NetUtil.readInputStreamToString(imgEncoder, imgEncoder.available());
         return xpc.imgTools.decodeImageFromBuffer(imgBuffer, imgBuffer.length, "image/png");
      }
   }
   
   var getCanvasAsImgContainer = function (canvas, width, height)
   {
      var imageData = canvas.getContext('2d').getImageData(
            0, 0, width, height);

      /* Create an imgIEncoder so we can turn the image data into a PNG stream. */
      let imgEncoder = Cc["@mozilla.org/image/encoder;2?type=image/png"].getService(Components.interfaces.imgIEncoder);
      imgEncoder.initFromData(
         imageData.data,
         imageData.data.length,
         imageData.width,
         imageData.height,
         imageData.width * 4,
         imgEncoder.INPUT_FORMAT_RGBA,
         "");

      /* Now turn the PNG stream into an imgIContainer. */
      let iconImage = decodeImageToPng(imgEncoder);

      /* Close the PNG stream. */
      imgEncoder.close();
      return iconImage;
   }

   var forceImgIContainerDecode = function (imgIContainer)
   {
      xpc.imgTools.encodeImage(imgIContainer, "image/png");
   }

   var createCircularBadgeStyle = function (imageWidth, imageHeight, canvas, text)
   {
      var cxt = canvas.getContext("2d");

      // Draw the background.
      cxt.save();
      // Solid color first.
      cxt.fillStyle = Services.prefs.getCharPref(prefsPrefix + "badgeColor");
      cxt.beginPath();
      cxt.arc(imageWidth / 2, imageHeight / 2, imageWidth / 2.15, 0, Math.PI * 2, true);
      cxt.fill();
      cxt.clip();
      cxt.closePath();

      // Create a gradient to blend on top of it.
      var gradient = cxt.createRadialGradient(
            imageWidth / 2, imageHeight / 2.5, 0,
            imageWidth / 2, imageHeight / 2, imageWidth / 2);
      gradient.addColorStop(0, "rgba(255,255,255,0)");
      gradient.addColorStop(1, "rgba(0,0,0,0.5)");
      cxt.fillStyle = gradient;

      // Blend it.
      cxt.beginPath();
      cxt.arc(imageWidth / 2, imageHeight / 2, imageWidth / 2.15, 0, Math.PI * 2, true);
      cxt.fill();
      cxt.clip();
      cxt.closePath();

      // Add highlight.
      cxt.fillStyle = "rgba(255,255,255,0.2)";
      cxt.scale(1, 0.5);
      cxt.beginPath();
      cxt.arc(imageWidth / 2, imageHeight / 2, imageWidth / 2.15, 0, Math.PI * 2, true);
      cxt.fill();
      cxt.closePath();
      cxt.restore();

      // Draw the frame.
      cxt.save();
      cxt.shadowOffsetX = 0;
      cxt.shadowOffsetY = 0;
      cxt.shadowColor = "rgba(0,0,0,0.7)";
      cxt.shadowBlur = imageWidth / 10;
      cxt.strokeStyle = Services.prefs.getCharPref(prefsPrefix + "textColor");
      cxt.lineWidth = imageWidth / 10;
      cxt.beginPath();
      cxt.arc(imageWidth / 2, imageHeight / 2, imageWidth / 2.15, 0, Math.PI * 2, true);
      cxt.stroke();
      cxt.closePath();
      cxt.restore();

      cxt.shadowOffsetX = 0;
      cxt.shadowOffsetY = 0;
      cxt.shadowColor = "rgba(0,0,0,0.7)";
      cxt.shadowBlur = imageWidth / 10;
      cxt.font = (imageHeight * 0.7) + "px Calibri bold";
      cxt.textAlign = "center";
      cxt.textBaseline = "middle";
      cxt.fillStyle = "white";
      cxt.fillText(text, imageWidth / 2, imageHeight / 2);
   }

   /* Returns the size of the icon overlay.
    *
    * The Mozilla framework will scale any icon we supply to the right size (handled
    * in nsWindowGfx::CreateIcon), but the scaling looks pretty crappy. If we know
    * what size we need, we can generate something that looks a lot nicer.
    *
    * If this were native code, GetSystemMetrics(SM_CXSMICON) would be exactly what
    * we would do. Even within the Mozilla framework, nsWindowGfx::GetIconMetrics(
    * nsWindowGfx::kSmallIcon) would also work, but it's not exposed via XPCOM.
    *
    * So instead we have to do it the hard way, and try to figure out what Windows
    * is going to do based on registry entries. Yuck.
    *
    * Relevant entries are:
    * - HKEY_CURRENT_USER\Control Panel\Desktop\WindowMetrics, "Shell Small Icon Size"
    *   (might not exist, if not then move on to:)
    * - HKEY_CURRENT_USER\Control Panel\Desktop\WindowMetrics, "Shell Icon Size"
    *   (if exists and the small one doesn't, then take it and divide by two)
    * - HKEY_CURRENT_USER\Control Panel\Desktop\WindowMetrics, "AppliedDPI".
    *   Default is 96. Scales up based on magnification setting. (125% is 120, 150% is 144, etc).
    *
    * The resulting icon size is (AppliedDPI / 96) * SmallIconSize.
    *
    * We memoize this, because Windows requires a logoff/logon when changing these
    * settings, which means there's no need for us to requery every time during the
    * lifetime of a single Thunderbird process.
    */
   var overlayIconSize = (function ()
   {
      var smallIconSize = 16;
      var appliedDpi = 96;

      let nsIWindowsRegKey = Components.classes["@mozilla.org/windows-registry-key;1"].getService(Components.interfaces.nsIWindowsRegKey);
      nsIWindowsRegKey.open(
         nsIWindowsRegKey.ROOT_KEY_CURRENT_USER,
         "Control Panel\\Desktop\\WindowMetrics",
         nsIWindowsRegKey.ACCESS_READ);

      if (nsIWindowsRegKey.hasValue("Shell Small Icon Size") && nsIWindowsRegKey.getValueType("Shell Small Icon Size") == nsIWindowsRegKey.TYPE_INT)
         smallIconSize = nsIWindowsRegKey.readIntValue("Shell Small Icon Size");
      else if (nsIWindowsRegKey.hasValue("Shell Icon Size") && nsIWindowsRegKey.getValueType("Shell Icon Size") == nsIWindowsRegKey.TYPE_INT)
         smallIconSize = Math.floor(nsIWindowsRegKey.readIntValue("Shell Icon Size") / 2);

      if (nsIWindowsRegKey.hasValue("AppliedDPI") && nsIWindowsRegKey.getValueType("AppliedDPI") == nsIWindowsRegKey.TYPE_INT)
         appliedDpi = nsIWindowsRegKey.readIntValue("AppliedDPI");

      nsIWindowsRegKey.close();

      return (Math.floor(appliedDpi / 96 * smallIconSize));
   }
   )();

   /* Make a badge icon for an unread message count of 'msgCount'.
    *
    * Returns an imgIContainer.
    */
   var createBadgeIcon = function (msgCount)
   {
      const iconSize = overlayIconSize;

      if (msgCount < 0)
         msgCount == 0;

      var msgText = "";
      if (msgCount <= 99)
         msgText = msgCount.toString();
      else
         msgText = "99+";

      let badge = gActiveWindow.document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
      badge.width = badge.height = iconSize;
      badge.style.width = badge.style.height = iconSize + "px";
      createCircularBadgeStyle(iconSize, iconSize, badge, msgText);

      return getCanvasAsImgContainer(badge, iconSize, iconSize);
   }

   /* Get the first window. */
   var findActiveWindow = function ()
   {
      let windows = Services.wm.getEnumerator(null);
      let win = windows.hasMoreElements() ? windows.getNext().QueryInterface(Ci.nsIDOMWindow) : null;
      setActiveWindow(win);
   }

   var gActiveWindow = null;
   var setActiveWindow = function (aWin)
   {
      // We're assuming that if gActiveWindow is non-null, we only get called when
      // it's closed.
      gActiveWindow = aWin;
      if (gActiveWindow)
         updateOverlayIcon();
   }

   var gWindowObserver =
   {
      observe : function (aSubject, aTopic, aData)
      {
         // Look for domwindowopened and domwindowclosed messages
         let win = aSubject.QueryInterface(Ci.nsIDOMWindow);
         if (aTopic == "domwindowopened")
         {
            if (!gActiveWindow)
               setActiveWindow(win);
         }
         else if (aTopic == "domwindowclosed")
         {
            if (win == gActiveWindow)
               findActiveWindow();
         }
      }
   };

   /* Enumerate all accounts and get the combined unread count. */
   var getUnreadCountForAllAccounts = function ()
   {
      let accounts = xpc.acctMgr.accounts;
      let totalCount = 0;
      let accountEnumerator = accounts.enumerate();
      let ignoreMask = 0;
      let acceptMask = -1;

      /* Only look at primary inbox? */
      if (Services.prefs.getBoolPref(prefsPrefix + "inboxOnly"))
         acceptMask = nsMsgFolderFlags.Inbox;

      ignoreMask |= nsMsgFolderFlags.Newsgroup;
      ignoreMask |= nsMsgFolderFlags.NewsHost;
      ignoreMask |= nsMsgFolderFlags.Virtual;
      ignoreMask |= nsMsgFolderFlags.Subscribed;

      if (Services.prefs.getBoolPref(prefsPrefix + "ignoreJunk"))
         ignoreMask |= nsMsgFolderFlags.Junk;
      if (Services.prefs.getBoolPref(prefsPrefix + "ignoreDrafts"))
         ignoreMask |= nsMsgFolderFlags.Drafts;
      if (Services.prefs.getBoolPref(prefsPrefix + "ignoreTrash"))
         ignoreMask |= nsMsgFolderFlags.Trash;
      if (Services.prefs.getBoolPref(prefsPrefix + "ignoreSent"))
         ignoreMask |= nsMsgFolderFlags.SentMail;

      while (accountEnumerator.hasMoreElements())
      {
         let account = accountEnumerator.getNext().QueryInterface(Ci.nsIMsgAccount);
         let rootFolder = account.incomingServer.rootMsgFolder;
         /* nsIMsgFolder */

         /* You'd think that 'rootFolder.getNumUnread(true)' would do a deep search
         and give us all the unread messages in this account, right? Wrong!
         Apparently you have to get all subfolders that are inboxes and do
         getNumUnread(true) on *those*. */
         if (((rootFolder.flags & ignoreMask) == 0) && (account.incomingServer.type != "rss"))
            totalCount += getUnreadCountForFolder(rootFolder, ignoreMask, acceptMask);
      }
      return totalCount;
   }

   var getUnreadCountForFolder = function (folder, ignoreMask, acceptMask)
   {
      var totalCount = 0;
      var subfoldersEnumerator = folder.subFolders;
      while (subfoldersEnumerator.hasMoreElements())
      {
         var subfolder = subfoldersEnumerator.getNext().QueryInterface(Ci.nsIMsgFolder);

         /* If there are subfolders, recurse. */
         if (subfolder.hasSubFolders)
            totalCount += getUnreadCountForFolder(subfolder, ignoreMask, acceptMask);

         /* Only add to the unread count if it's not a type we want to ignore. */
         if (((subfolder.flags & ignoreMask) == 0) && !!(subfolder.flags & acceptMask))
            totalCount += subfolder.getNumUnread(false);
      }
      return totalCount;
   }

   var getActiveWindowOverlayIconController = function ()
   {
      let docshell = gActiveWindow.QueryInterface(Ci.nsIInterfaceRequestor)
         .getInterface(Ci.nsIWebNavigation).QueryInterface(Ci.nsIDocShellTreeItem)
         .treeOwner.QueryInterface(Ci.nsIInterfaceRequestor)
         .getInterface(Ci.nsIXULWindow).docShell;

      return xpc.taskbar.getOverlayIconController(docshell);
   }

   var updateTimerId = null;

   var updateOverlayIcon = function ()
   {
      if (gActiveWindow)
      {
         let controller = getActiveWindowOverlayIconController();

         var messageCount = getUnreadCountForAllAccounts();
         if (messageCount > 0)
         {
            var icon = createBadgeIcon(messageCount);
            forceImgIContainerDecode(icon);
            controller.setOverlayIcon(icon, "Message Count");
         }
         else
         {
            controller.setOverlayIcon(null, "");
         }

         gActiveWindow.clearTimeout(updateTimerId);
         updateTimerId = null;
      }
   }

   var clearOverlayIcon = function ()
   {
      if (gActiveWindow)
      {
         let controller = getActiveWindowOverlayIconController();
         controller.setOverlayIcon(null, "");
      }
   }

   /* From the folder listener, if we try to update, we'll get the old update counts. */
   var queueOverlayIconUpdate = function ()
   {
      if (gActiveWindow)
      {
         if (updateTimerId == null)
         {
            updateTimerId = gActiveWindow.setTimeout(updateOverlayIcon, 100);
         }
      }
   }

   /* Implementation of nsIFolderListener */
   var folderListener =
   {
      OnItemPropertyFlagChanged : function (item, property, oldFlag, newFlag)
      {
         if (property == "Status")
            queueOverlayIconUpdate();
      },
      OnItemEvent : function (item, event)
      {
         queueOverlayIconUpdate();
      }
   };

   /* Implementation of nsIMsgFolderListener */
   var msgFolderListener =
   {
      msgAdded : function (msg)
      {
         /* Only update if the new message is unread. */
         if (msg.isRead == false)
         {
            queueOverlayIconUpdate();
         }
      },
      msgsDeleted : function (msgs)
      {
         /* Check to see if there's an unread message among the things we're deleting.
         If so, then we should update the badge. */
         var deletingUnreadMessage = false;
         var msgsEnumerator = msgs.enumerate();
         while (msgsEnumerator.hasMoreElements())
         {
            var msg = msgsEnumerator.getNext().QueryInterface(Ci.nsIMsgDBHdr);
            if (msg.isRead)
            {
               deletingUnreadMessage = true;
               break;
            }
         }

         if (deletingUnreadMessage)
            queueOverlayIconUpdate();
      },
      folderDeleted : function (folder)
      {
         /* If we're deleting a folder, just go ahead and queue an update. */
         queueOverlayIconUpdate();
      },
   };

   var prefsObserver =
   {
      observe : function (aSubject, aTopic, aData)
      {
         queueOverlayIconUpdate();
      }
   };

   /* The exported interface */
   var exportedInterface =
   {
      install : function ()
      {
         /* nothing to do */
      },
      startup : function (aData, aReason)
      {
         setDefaultPreferences();
         if (!xpc.taskbar.available)
            return;
         Services.ww.registerNotification(gWindowObserver);
         xpc.mailSession.AddFolderListener(folderListener, Ci.nsIFolderListener.propertyFlagChanged | Ci.nsIFolderListener.event);
         xpc.notificationService.addListener(msgFolderListener, xpc.notificationService.msgAdded | xpc.notificationService.msgsDeleted | xpc.notificationService.folderDeleted | xpc.notificationService.itemEvent);
         Services.prefs.addObserver(prefsPrefix, prefsObserver, false);
         findActiveWindow();
      },
      shutdown : function (aData, aReason)
      {
         xpc.notificationService.removeListener(msgFolderListener);
         xpc.mailSession.RemoveFolderListener(folderListener);
         Services.ww.unregisterNotification(gWindowObserver);
         Services.prefs.removeObserver(prefsPrefix, prefsObserver);
         clearOverlayIcon();
      },
      uninstall : function ()
      {
         /* nothing to do */
      }
   }
   return exportedInterface;
}
();

function install()
{
   net.streiff.unreadbadge.install();
}

function startup(aData, aReason)
{
   net.streiff.unreadbadge.startup(aData, aReason);
}

function shutdown(aData, aReason)
{
   net.streiff.unreadbadge.shutdown(aData, aReason);
}

function uninstall()
{
   net.streiff.unreadbadge.uninstall();
}
