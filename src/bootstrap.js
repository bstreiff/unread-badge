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

var unreadbadge = function ()
{
   const Cc = Components.classes;
   const Ci = Components.interfaces;

   /* See https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsMsgFolderFlagType
   for what all of these mean.
    */
   const nsMsgFolderFlags = Ci.nsMsgFolderFlags;

   const DEFAULT_PREFERENCES =
   {
      "badgeStyle" : "modern",
      "includeJunk" : false,
      "includeDrafts" : false,
      "includeTrash" : false,
      "includeSent" : false,
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

   var setDefaultPreferences = async function()
   {
      const SCHEMA_VERSION = 1;
      const results = await messenger.storage.local.get("preferences");
      const currentSchema = (results.preferences && results.preferences.schema ? results.preferences.schema : 0);

      if (currentSchema >= SCHEMA_VERSION)
         return;

      let newPrefsObj = results.preferences || {};

      for (let key in DEFAULT_PREFERENCES) {
         if (DEFAULT_PREFERENCES.hasOwnProperty(key)) {
            if (!newPrefsObj.hasOwnProperty(key)) {
               newPrefsObj[key] = DEFAULT_PREFERENCES[key];
            }
         }
      }

      newPrefsObj.version = SCHEMA_VERSION;
      await messenger.storage.local.set({ preferences: newPrefsObj });
   }

   var decodeImageToPng = function (imgEncoder)
   {
      let imgBuffer = NetUtil.readInputStreamToString(imgEncoder, imgEncoder.available());
      return xpc.imgTools.decodeImageFromBuffer(imgBuffer, imgBuffer.length, "image/png");
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

   var isDecodedImgIContainer = function (imgIContainer)
   {
      try {
        /* Result is not needed, only whether it throws exception */
        imgIContainer.animated;
      } catch (err) {
        if (err.result == 2147746065) {
          /* 0x80040111 (NS_ERROR_NOT_AVAILABLE) */
          return false;
        }
      }

      return true;
   }

   var sleep = function (ms)
   {
     return new Promise(resolve => gActiveWindow.setTimeout(resolve, ms));
   }

   /*
    * When setOverlayIcon() receives an image that is not decoded yet,
    * it throws NS_ERROR_NOT_AVAILABLE when trying to check whether
    * image is animated, see these in Thunderbird sources:
    * TaskbarWindowPreview::SetOverlayIcon()
    * RasterImage::GetAnimated()
    */
   var forceImgIContainerDecode = async function (imgIContainer)
   {
      /* Purge image from cache to force encodeImage() to not be lazy */
      imgIContainer.requestDiscard();

      /* Side effect of encodeImage() is that it decodes original image */
      xpc.imgTools.encodeImage(imgIContainer, "image/png");

      /* To make it worse, .encode() uses 'FLAG_ASYNC_NOTIFY' which causes
       * 'mHasBeenDecoded' to be lazily updated on the thread that runs this
       * script. In order to make it happen, pause the script a bit. Wait
       * until '.animated' stops returning 'NS_ERROR_NOT_AVAILABLE'.
       */
      await sleep(0);
      if (isDecodedImgIContainer())
        return;

      /* No luck, wait longer */
      for (i = 0; i < 32; i++) {
        await sleep(32);
        if (isDecodedImgIContainer()) {
          console.log("unread-badge: forceImgIContainerDecode() took " + i + " sleep iterations");
          return;
        }
      }

      console.log("unread-badge: forceImgIContainerDecode() is broken again");
   }

   /* Draw text centered in the middle of a CanvasRenderingContext2D */
   var drawUnreadCountText = function (cxt, text)
   {
      cxt.save();

      const imageSize = cxt.canvas.width;

      // Use smaller fonts for longer text to try and squeeze it in.
      const fontSize = (imageSize * (0.95 - (0.15 * text.length)));

      cxt.shadowOffsetX = 0;
      cxt.shadowOffsetY = 0;
      cxt.shadowColor = "rgba(0,0,0,0.7)";
      cxt.shadowBlur = imageSize / 10;
      cxt.font = "600 " + fontSize + "px Calibri";
      cxt.fillStyle = '#FAFAFA';
      cxt.textAlign = "center";

      // TODO: There isn't a textBaseline for accurate vertical centering ('middle' is the
      // middle of the 'em block', and digits extend higher than 'm'), and the Mozilla core
      // does not currently support computation of ascenders and descenters in measureText().
      // So, we just assume that the font is 70% of the 'px' height we requested, then
      // compute where the baseline ought to be located.
      const approximateHeight = fontSize * 0.70;

      cxt.textBaseline = "alphabetic";
      cxt.fillText(text, imageSize / 2, imageSize - (imageSize - approximateHeight) / 2);

      cxt.restore();
   }

   /* Create a "dot" badge, akin to Discord. */
   var createDotBadgeStyle = function (canvas, text)
   {
      var cxt = canvas.getContext("2d");
      const iconSize = canvas.width;

      // Draw the background.
      cxt.save();
      // Solid color first.
      cxt.fillStyle = '#EF5858';
      cxt.beginPath();
      cxt.arc(iconSize / 2, iconSize / 2, iconSize / 2.25, 0, Math.PI * 2, true);
      cxt.fill();
      cxt.clip();
      cxt.closePath();
      cxt.restore();

      // Draw the dot.
      cxt.save();
      cxt.fillStyle = '#FAFAFA';
      cxt.beginPath();
      cxt.arc(iconSize / 2, iconSize / 2, iconSize / 5, 0, Math.PI * 2, true);
      cxt.fill();
      cxt.closePath();
      cxt.restore();
   }

   /* Create a circular badge with a frame, akin to OS X prior to Yosemite. */
   var createFruityBadgeStyle = function (canvas, text)
   {
      var cxt = canvas.getContext("2d");
      const iconSize = canvas.width;

      // Draw the background.
      cxt.save();
      // Solid color first.
      cxt.fillStyle = '#FF0000';
      cxt.beginPath();
      cxt.arc(iconSize / 2, iconSize / 2, iconSize / 2.15, 0, Math.PI * 2, true);
      cxt.fill();
      cxt.clip();
      cxt.closePath();

      // Create a gradient to blend on top of it.
      var gradient = cxt.createRadialGradient(
            iconSize / 2, iconSize / 2.5, 0,
            iconSize / 2, iconSize / 2, iconSize / 2);
      gradient.addColorStop(0, "rgba(255,255,255,0)");
      gradient.addColorStop(1, "rgba(0,0,0,0.5)");
      cxt.fillStyle = gradient;

      // Blend it.
      cxt.beginPath();
      cxt.arc(iconSize / 2, iconSize / 2, iconSize / 2.15, 0, Math.PI * 2, true);
      cxt.fill();
      cxt.clip();
      cxt.closePath();

      // Add highlight.
      cxt.fillStyle = "rgba(255,255,255,0.2)";
      cxt.scale(1, 0.5);
      cxt.beginPath();
      cxt.arc(iconSize / 2, iconSize / 2, iconSize / 2.15, 0, Math.PI * 2, true);
      cxt.fill();
      cxt.closePath();
      cxt.restore();

      // Draw the frame.
      cxt.save();
      cxt.shadowOffsetX = 0;
      cxt.shadowOffsetY = 0;
      cxt.shadowColor = "rgba(0,0,0,0.7)";
      cxt.shadowBlur = iconSize / 10;
      cxt.strokeStyle = '#FAFAFA';
      cxt.lineWidth = iconSize / 10;
      cxt.beginPath();
      cxt.arc(iconSize / 2, iconSize / 2, iconSize / 2.15, 0, Math.PI * 2, true);
      cxt.stroke();
      cxt.closePath();
      cxt.restore();

      drawUnreadCountText(cxt, text);
   }

   /* Create a flat badge, as is the Windows 8/10 style. */
   var createModernBadgeStyle = function (canvas, text)
   {
      var cxt = canvas.getContext("2d");
      const iconSize = canvas.width;

      // Draw the background.
      cxt.save();
      // Solid color first.
      cxt.fillStyle = '#D01536';
      cxt.shadowOffsetX = 0;
      cxt.shadowOffsetY = 0;
      cxt.shadowColor = "rgba(0,0,0,0.8)";
      cxt.shadowBlur = iconSize / 10;
      cxt.beginPath();
      cxt.arc(iconSize / 2, iconSize / 2, iconSize / 2.25, 0, Math.PI * 2, true);
      cxt.fill();
      cxt.clip();
      cxt.closePath();
      cxt.restore();

      drawUnreadCountText(cxt, text);
   }

   /* Create an "envelope" badge, as is Outlook's style. */
   var createEnvelopeBadgeStyle = function (canvas, text)
   {
      var cxt = canvas.getContext("2d");
      const iconSize = canvas.width;

      const envelopeWidth = 0.9375 * iconSize;
      const envelopeHeight = 0.6875 * iconSize;
      const lineWidth = 0.09375 * iconSize;
      const foldTop = 0.09375 * iconSize;
      const foldBottom = 0.4375 * iconSize;
      const startX = iconSize - envelopeWidth;
      const startY = iconSize - envelopeHeight;

      // Draw the background.
      cxt.save();
      cxt.fillStyle = '#E9B471';
      cxt.fillRect(startX, startY, envelopeWidth, envelopeHeight);
      cxt.restore();

      // Draw the strokes for the fold.
      cxt.save();
      cxt.strokeStyle = '#FFFFFF';
      cxt.lineWidth = lineWidth;
      cxt.beginPath();
      cxt.moveTo(startX, startY + foldTop);
      cxt.lineTo(startX + envelopeWidth / 2, startY + foldBottom);
      cxt.lineTo(startX + envelopeWidth, startY + foldTop);
      cxt.stroke();
      cxt.restore();
   }

   /* Returns the size of the icon overlay. */
   var overlayIconSize = function (window)
   {
      var smallIconSize = Cc["@mozilla.org/windows-ui-utils;1"].getService(Ci.nsIWindowsUIUtils).systemSmallIconSize;
      var appliedDpi = window.windowUtils.displayDPI;

      return (Math.floor(appliedDpi / 96 * smallIconSize));
   };

   var iconStyles =
   {
      "dot": createDotBadgeStyle,
      "envelope": createEnvelopeBadgeStyle,
      "fruity": createFruityBadgeStyle,
      "modern": createModernBadgeStyle,
   };

   /* Make a badge icon for an unread message count of 'msgCount'.
    *
    * Returns an imgIContainer.
    */
   var createBadgeIcon = async function (window, msgCount)
   {
      const iconSize = overlayIconSize(window);
      const iconSize4X = iconSize * 4;

      if (msgCount < 0)
         msgCount == 0;

      var msgText = "";
      if (msgCount <= 99)
         msgText = msgCount.toString();
      else
         msgText = "99+";

      let prefsResult = await messenger.storage.local.get("preferences");
      let prefs = prefsResult.preferences;
      let badgeStyle = prefs.badgeStyle;
      if (badgeStyle === undefined || !iconStyles.hasOwnProperty(badgeStyle))
         badgeStyle = "modern";

      let badge = gActiveWindow.document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
      badge.width = badge.height = iconSize4X;
      badge.style.width = badge.style.height = badge.width + "px";

      iconStyles[badgeStyle](badge, msgText);

      badge = downsampleBy4X(badge);

      return getCanvasAsImgContainer(badge, iconSize, iconSize);
   }

   /* Downsample by 4X with simple averaging.
    *
    * Drawing at 4X and then downscaling like this gives us better results than
    * using either CanvasRenderingContext2D.drawImage() to resize or letting
    * the Windows taskbar service handle the resize, both of which seem to just
    * give us a simple point resize.
    *
    * Returns a new <canvas> element.
    */
   var downsampleBy4X = function (canvas)
   {
      let resizedCanvas = gActiveWindow.document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
      resizedCanvas.width = resizedCanvas.height = canvas.width / 4;
      resizedCanvas.style.width = resizedCanvas.style.height = resizedCanvas.width + "px";

      let source = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
      let downsampled = resizedCanvas.getContext("2d").createImageData(resizedCanvas.width, resizedCanvas.height);

      for (let y = 0; y < resizedCanvas.height; ++y) {
         for (let x = 0; x < resizedCanvas.width; ++x) {
            let r = 0, g = 0, b = 0, a = 0;
            let index;

            for (let i = 0; i < 4; ++i) {
               for (let j = 0; j < 4; ++j) {
                  index = (((y*4)+i) * source.width + ((x*4)+j)) * 4;
                  r += source.data[index];
                  g += source.data[index + 1];
                  b += source.data[index + 2];
                  a += source.data[index + 3];
               }
            }

            index = (y * downsampled.width + x) * 4;
            downsampled.data[index] = Math.round(r / 16);
            downsampled.data[index+1] = Math.round(g / 16);
            downsampled.data[index+2] = Math.round(b / 16);
            downsampled.data[index+3] = Math.round(a / 16);
         }
      }

      resizedCanvas.getContext("2d").putImageData(downsampled, 0, 0);

      return resizedCanvas;
   }

   /* Get the first window. */
   var findActiveWindow = async function ()
   {
      let windows = Services.wm.getEnumerator(null);
      let win = windows.hasMoreElements() ? windows.getNext() : null;
      await setActiveWindow(win);
   }

   var gActiveWindow = null;
   var setActiveWindow = async function (aWin)
   {
      // We're assuming that if gActiveWindow is non-null, we only get called when
      // it's closed.
      gActiveWindow = aWin;
      if (gActiveWindow)
         await updateOverlayIcon();
   }

   var gWindowObserver =
   {
      observe : async function (aSubject, aTopic, aData)
      {
         // Look for domwindowopened and domwindowclosed messages
         if (aTopic == "domwindowopened")
         {
            if (!gActiveWindow)
               await setActiveWindow(aSubject);
         }
         else if (aTopic == "domwindowclosed")
         {
            if (aSubject == gActiveWindow)
               await findActiveWindow();
         }
      }
   };

   /* Enumerate all accounts and get the combined unread count. */
   var getUnreadCountForAllAccounts = async function ()
   {
      let accounts = xpc.acctMgr.accounts;
      let totalCount = 0;
      let ignoreMask = 0;
      let acceptMask = -1;

      /* Only look at primary inbox? */
      let prefsResult = await messenger.storage.local.get("preferences");
      let prefs = prefsResult.preferences;

      if (prefs.inboxOnly)
         acceptMask = nsMsgFolderFlags.Inbox;

      ignoreMask |= nsMsgFolderFlags.Newsgroup;
      ignoreMask |= nsMsgFolderFlags.NewsHost;
      ignoreMask |= nsMsgFolderFlags.Virtual;
      ignoreMask |= nsMsgFolderFlags.Subscribed;

      if (!prefs.includeJunk)
         ignoreMask |= nsMsgFolderFlags.Junk;
      if (!prefs.includeDrafts)
         ignoreMask |= nsMsgFolderFlags.Drafts;
      if (!prefs.includeTrash)
         ignoreMask |= nsMsgFolderFlags.Trash;
      if (!prefs.includeSent)
         ignoreMask |= nsMsgFolderFlags.SentMail;

      for (const account of accounts)
      {
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
      let docshell = Cc["@mozilla.org/appshell/window-mediator;1"]
        .getService(Ci.nsIWindowMediator)
        .getMostRecentBrowserWindow()
        .docShell;

      return xpc.taskbar.getOverlayIconController(docshell);
   }

   var updateTimerId = null;

   var updateOverlayIcon = async function ()
   {
      if (gActiveWindow)
      {
         let controller = getActiveWindowOverlayIconController();

         var messageCount = await getUnreadCountForAllAccounts();
         if (messageCount > 0)
         {
            var icon = await createBadgeIcon(gActiveWindow, messageCount);
            await forceImgIContainerDecode(icon);
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

   /* The exported interface */
   var exportedInterface =
   {
      install : function ()
      {
         /* nothing to do */
      },
      startup : async function (aData, aReason)
      {
         await setDefaultPreferences();
         if (!xpc.taskbar.available)
            return;
         Services.ww.registerNotification(gWindowObserver);
         xpc.mailSession.AddFolderListener(folderListener, Ci.nsIFolderListener.propertyFlagChanged | Ci.nsIFolderListener.event);
         xpc.notificationService.addListener(msgFolderListener, xpc.notificationService.msgAdded | xpc.notificationService.msgsDeleted | xpc.notificationService.folderDeleted | xpc.notificationService.itemEvent);
         await findActiveWindow();
         messenger.storage.onChanged.addListener(queueOverlayIconUpdate);
      },
      shutdown : function (aData, aReason)
      {
         xpc.notificationService.removeListener(msgFolderListener);
         xpc.mailSession.RemoveFolderListener(folderListener);
         Services.ww.unregisterNotification(gWindowObserver);
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
   unreadbadge.install();
}

function startup(aData, aReason)
{
   unreadbadge.startup(aData, aReason);
}

function shutdown(aData, aReason)
{
   unreadbadge.shutdown(aData, aReason);
}

function uninstall()
{
   unreadbadge.uninstall();
}
