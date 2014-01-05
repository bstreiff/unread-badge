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

net.streiff.unreadbadge = function()
{
   const Cc = Components.classes;
   const Ci = Components.interfaces;
   
   Components.utils.import("resource://gre/modules/Services.jsm");
   Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

   var xpc = {};
   
   XPCOMUtils.defineLazyServiceGetter(xpc, "imgTools", "@mozilla.org/image/tools;1", "imgITools");
   XPCOMUtils.defineLazyServiceGetter(xpc, "taskbar", "@mozilla.org/windows-taskbar;1", "nsIWinTaskbar");
   XPCOMUtils.defineLazyServiceGetter(xpc, "acctMgr", "@mozilla.org/messenger/account-manager;1", "nsIMsgAccountManager");
   XPCOMUtils.defineLazyServiceGetter(xpc, "mailSession", "@mozilla.org/messenger/services/session;1", "nsIMsgMailSession");
   var Application = Components.classes["@mozilla.org/steel/application;1"].getService(Components.interfaces.steelIApplication);
   var console = Application.console;

   var BadgeImage = function(w, h)
   {
      this.data = new Uint8ClampedArray(w*h*4);
      this.width = w;
      this.height = h;
      this.stride = w*4;
   };

   BadgeImage.prototype.drawRect = function(x, y, w, h, r, g, b, a)
   {
      for (let i = 0; i < h; i++)
      {
         for (let j = 0; j < w; j++)
         {
            let offset = ((y+i)*this.stride) + ((x+j)*4);
            this.data[offset  ] = r;
            this.data[offset+1] = g;
            this.data[offset+2] = b;
            this.data[offset+3] = a;
         }
      }
   }

   BadgeImage.prototype.getAsImgContainer = function()
   {
      /* Create an imgIEncoder so we can turn the image data into a PNG stream. */
      let imgEncoder = Cc["@mozilla.org/image/encoder;2?type=image/png"].getService(Components.interfaces.imgIEncoder);
      imgEncoder.initFromData(
         this.data,
         this.data.length,
         this.width,
         this.height,
         this.stride,
         imgEncoder.INPUT_FORMAT_RGBA,
         "");

      /* Now turn the PNG stream into an imgIContainer. */
      let iconImage = xpc.imgTools.decodeImage(imgEncoder, "image/png");

      /* Close the PNG stream. */
      imgEncoder.close();
      return iconImage;
   }
   
   /* It'd be useful if there were a way to actually render a font, but I can't find an interface to do it.
    *
    * So, we'll pretend like it's the 90s and we'll blit prerendered numbers down by hand.
    */
   var DigitImage = function(w, h, data)
   {
      this.width = w;
      this.height = h;
      this.stride = this.width;
      this.data = new Uint8Array(data);
   }

   const digit_0 = new DigitImage(5, 8, [23, 199, 255, 199, 23, 155, 255, 95, 255, 155, 223, 255, 0, 255, 223, 255, 255, 0, 255, 255, 255, 255, 0, 255, 255, 223, 255, 0, 255, 223, 155, 255, 95, 255, 155, 23, 199, 255, 199, 23]);
   const digit_1 = new DigitImage(5, 8, [0, 0, 187, 255, 0, 47, 191, 255, 255, 0, 255, 211, 255, 255, 0, 183, 23, 255, 255, 0, 0, 0, 255, 255, 0, 0, 0, 255, 255, 0, 0, 0, 255, 255, 0, 0, 0, 255, 255, 0]);
   const digit_2 = new DigitImage(5, 8, [71, 215, 255, 215, 59, 203, 255, 43, 255, 215, 0, 0, 11, 255, 255, 0, 0, 123, 255, 187, 0, 83, 251, 231, 31, 51, 251, 207, 27, 0, 187, 175, 11, 0, 0, 243, 255, 255, 255, 143]);
   const digit_3 = new DigitImage(5, 8, [63, 211, 255, 215, 63, 191, 243, 47, 255, 235, 0, 0, 39, 255, 207, 0, 0, 239, 231, 35, 0, 0, 43, 255, 199, 0, 0, 0, 255, 255, 199, 247, 63, 255, 187, 59, 215, 255, 195, 35]);
   const digit_4 = new DigitImage(5, 8, [0, 0, 99, 255, 255, 0, 15, 211, 255, 255, 0, 139, 111, 255, 255, 39, 223, 7, 255, 255, 183, 95, 0, 255, 255, 255, 255, 255, 255, 255, 0, 0, 0, 255, 255, 0, 0, 0, 255, 255]);
   const digit_5 = new DigitImage(5, 8, [27, 255, 255, 255, 255, 79, 255, 175, 0, 0, 139, 255, 111, 0, 0, 191, 255, 243, 235, 75, 207, 103, 47, 255, 219, 0, 0, 0, 255, 255, 195, 251, 67, 255, 191, 59, 215, 255, 199, 39]);
   const digit_6 = new DigitImage(5, 8, [11, 167, 247, 227, 75, 135, 255, 51, 243, 203, 215, 231, 0, 0, 0, 255, 239, 219, 235, 59, 255, 255, 63, 255, 215, 227, 255, 0, 255, 255, 151, 255, 67, 255, 207, 15, 179, 255, 215, 47]);
   const digit_7 = new DigitImage(5, 8, [255, 255, 255, 255, 255, 0, 0, 111, 255, 179, 0, 0, 227, 255, 47, 0, 59, 255, 199, 0, 0, 135, 255, 123, 0, 0, 187, 255, 67, 0, 0, 227, 255, 23, 0, 0, 255, 255, 0, 0]);
   const digit_8 = new DigitImage(5, 8, [79, 223, 255, 223, 79, 239, 255, 43, 255, 235, 203, 255, 43, 255, 199, 23, 227, 255, 235, 23, 171, 255, 71, 255, 179, 255, 255, 0, 255, 255, 211, 255, 75, 255, 211, 39, 203, 255, 203, 39]);
   const digit_9 = new DigitImage(5, 8, [43, 215, 255, 179, 15, 203, 255, 67, 255, 151, 255, 255, 0, 255, 223, 215, 225, 63, 255, 255, 63, 235, 219, 239, 255, 0, 0, 0, 231, 219, 203, 243, 51, 255, 135, 83, 235, 247, 167, 11]);
   const digit_plus = new DigitImage(3, 8, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 0, 255, 255, 255, 0, 255, 0, 0, 0, 0, 0, 0, 0]);
   const digit = [digit_0, digit_1, digit_2, digit_3, digit_4, digit_5, digit_6, digit_7, digit_8, digit_9];

   /* Draw the digit image to the pixel data array. */
   BadgeImage.prototype.drawDigit = function(digit, x, y)
   {
      for (let i = 0; i < digit.height; i++)
      {
         for (let j = 0; j < digit.width; j++)
         {
            let offset = ((y+i)*this.stride) + ((x+j)*4);
            let value = digit.data[(i*digit.stride) + j];

            this.data[offset  ] += value;
            this.data[offset+1] += value;
            this.data[offset+2] += value;
            this.data[offset+3] += value;
         }
      }
   }

   var createBadgeBackground = function(badge)
   {
      /* Draw a 15x15 square. */
      badge.drawRect(0, 0, 15, 15, 255, 0, 0, 255);
      /* Draw a drop-shadow. */
      badge.drawRect(1, 15, 15, 1, 0, 0, 0, 128);
      badge.drawRect(15, 1, 1, 15, 0, 0, 0, 128);
   }
   
   /* Make a badge icon for an unread message count of 'msgCount'.
    *
    * Returns an imgIContainer.
    */
   var createBadgeIcon = function(msgCount)
   {
      /* Taskbar overlay icons "should be a small icon, measuring 16x16 pixels at 96 dpi"
       * http://msdn.microsoft.com/en-us/library/dd391696(v=vs.85).aspx
       *
       * If we were to give a differently-sized image, it would be scaled for us.
       *
       * Despite the MSDN documentation, it might not be always 16x16, I'd assume it is
       * actually based on GetSystemMetrics(SM_CXSMICON/SM_CYSMICON). Right now we
       * always assume 16x16 though.
       */
      const imageWidth = 16;
      const imageHeight = 16;

      if (msgCount < 0) msgCount == 0;

      let badge = new BadgeImage(imageWidth, imageHeight);
      
      createBadgeBackground(badge);
      
      /* Draw the digits. */
      if (msgCount <= 9)
      {
         /* one digit */
         badge.drawDigit(digit[msgCount], 5, 3);
      }
      else if (msgCount <= 99)
      {
         /* two digits */
         badge.drawDigit(digit[Math.floor(msgCount / 10)], 2, 3);
         badge.drawDigit(digit[msgCount % 10], 8, 3);
      }
      else
      {
         /* 99+ */
         badge.drawDigit(digit[9], 1, 3);
         badge.drawDigit(digit[9], 7, 3);
         badge.drawDigit(digit_plus, 12, 3);
      }

      return badge.getAsImgContainer();
   }

   /* Get the first window. */
   var findActiveWindow = function()
   {
      let windows = Services.wm.getEnumerator(null);
      let win = windows.hasMoreElements() ? windows.getNext().QueryInterface(Ci.nsIDOMWindow) : null;
      setActiveWindow(win);
   }

   var gActiveWindow = null;
   var setActiveWindow = function(aWin)
   {
      // We're assuming that if gActiveWindow is non-null, we only get called when
      // it's closed.
      gActiveWindow = aWin;
      if (gActiveWindow)
        updateOverlayIcon();
   }

   var gWindowObserver =
   {
      observe: function(aSubject, aTopic, aData)
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
   var getUnreadCountForAllAccounts = function()
   {
      let accounts = xpc.acctMgr.accounts;
      let totalCount = 0;
      let accountEnumerator = accounts.enumerate();
      while (accountEnumerator.hasMoreElements())
      {
         let account = accountEnumerator.getNext().QueryInterface(Ci.nsIMsgAccount);
         let rootFolder = account.incomingServer.rootMsgFolder; /* nsIMsgFolder */

         /* You'd think that 'rootFolder.getNumUnread(true)' would do a deep search
            and give us all the unread messages in this account, right? Wrong!
            Apparently you have to get all subfolders that are inboxes and do
            getNumUnread(true) on *those*. */
         totalCount += getUnreadCountForFolder(rootFolder);
      }
      return totalCount;
   }

   /* See http://mxr.mozilla.org/mozilla1.8.0/source/mailnews/base/public/nsMsgFolderFlags.h
      for what all of these mean.
   */
   var nsMsgFolderFlags = {
      Newsgroup:       0x00000001,
      NewsHost:        0x00000002,
      Mail:            0x00000004,
      Directory:       0x00000008,
      Elided:          0x00000010,
      Virtual:         0x00000020,
      Subscribed:      0x00000040,
      Unused2:         0x00000080,
      Trash:           0x00000100,
      SentMail:        0x00000200,
      Drafts:          0x00000400,
      Queue:           0x00000800,
      Inbox:           0x00001000,
      ImapBox:         0x00002000,
      Unused3:         0x00004000,
      ProfileGroup:    0x00008000,
      Unused4:         0x00010000,
      GotNew:          0x00020000,
      ImapServer:      0x00040000,
      ImapPersonal:    0x00080000,
      ImapPublic:      0x00100000,
      ImapOtherUser:   0x00200000,
      Templates:       0x00400000,
      PersonalShared:  0x00800000,
      ImapNoselect:    0x01000000,
      CreatedOffline:  0x02000000,
      ImapNoinferiors: 0x04000000,
      Offline:         0x08000000,
      OfflineEvents:   0x10000000,
      CheckNew:        0x20000000,
      Junk:            0x40000000
   };
   
   var getUnreadCountForFolder = function(folder)
   {
      var totalCount = 0;
      var subfoldersEnumerator = folder.subFolders;
      while (subfoldersEnumerator.hasMoreElements())
      {
         var subfolder = subfoldersEnumerator.getNext().QueryInterface(Ci.nsIMsgFolder);

         /* If there are subfolders, recurse. */
         if (subfolder.hasSubFolders)
            totalCount += getUnreadCountForFolder(subfolder);

         /* Only add to the unread count if it's not Junk/Drafts/Trash/Sent. */
         if (!(subfolder.getFlag(nsMsgFolderFlags.Junk) ||
               subfolder.getFlag(nsMsgFolderFlags.Drafts) ||
               subfolder.getFlag(nsMsgFolderFlags.Trash) ||
               subfolder.getFlag(nsMsgFolderFlags.SentMail)))
         {
            totalCount += subfolder.getNumUnread(false);
         }
      }
      return totalCount;
   }

   var getActiveWindowOverlayIconController = function()
   {
      let docshell = gActiveWindow.QueryInterface(Ci.nsIInterfaceRequestor)
        .getInterface(Ci.nsIWebNavigation).QueryInterface(Ci.nsIDocShellTreeItem)
        .treeOwner.QueryInterface(Ci.nsIInterfaceRequestor)
        .getInterface(Ci.nsIXULWindow).docShell;

      return xpc.taskbar.getOverlayIconController(docshell);
   }

   var updateOverlayIcon = function()
   {
     if (gActiveWindow)
     {
         let controller = getActiveWindowOverlayIconController();

         var messageCount = getUnreadCountForAllAccounts();
         if (messageCount > 0)
         {
            var icon = createBadgeIcon(messageCount)
            controller.setOverlayIcon(icon, "Message Count");
         }
         else
         {
            controller.setOverlayIcon(null, "");
         }
     }
   }

   var clearOverlayIcon = function()
   {
     if (gActiveWindow)
     {
         let controller = getActiveWindowOverlayIconController();
         controller.setOverlayIcon(null, "");
     }
   }

   /* From the folder listener, if we try to update, we'll get the old update counts. */
   var queueOverlayIconUpdate = function()
   {
      if (gActiveWindow)
         gActiveWindow.setTimeout(updateOverlayIcon, 100);
   }

   /* Implementation of nsIFolderListener */
   var folderListener =
   {
       OnItemAdded: function(parent, item, viewString)
       {
          queueOverlayIconUpdate();
       },
       OnItemRemoved: function(parent, item, viewString)
       {
          queueOverlayIconUpdate();
       },
       OnItemPropertyFlagChanged: function(item, property, oldFlag, newFlag)
       {
          if (property == "Status")
              queueOverlayIconUpdate();
       },
       OnItemEvent: function(item, event)
       {
          queueOverlayIconUpdate();
       }
   };

   /* The exported interface */
   return {
      install: function()
      {
         /* nothing to do */
      },
      startup: function(aData, aReason)
      {
         if (!xpc.taskbar.available)
            return;
         Services.ww.registerNotification(gWindowObserver);
         xpc.mailSession.AddFolderListener(folderListener, Ci.nsIFolderListener.added|Ci.nsIFolderListener.removed|Ci.nsIFolderListener.propertyFlagChanged|Ci.nsIFolderListener.event);
         findActiveWindow();
      },
      shutdown: function(aData, aReason)
      {
         xpc.mailSession.RemoveFolderListener(folderListener);
         Services.ww.unregisterNotification(gWindowObserver);
         clearOverlayIcon();
      },
      uninstall: function()
      {
         /* nothing to do */
      }
   }
}();

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
