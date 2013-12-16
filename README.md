This is a simple Thunderbird extension for displaying an unread mail message count
on the Windows taskbar.

Currently (in Thunderbird 24.2) the only unread notification option is to put an
icon into the system tray ("notification area"). Windows 7 and later allow you to
actually badge the application's icon itself with an overlay. The Mozilla core
supports setting the overlay [1], but the bug for actually making Thunderbird use
the interface for doing so has languished for about four years [2]. Sigh.

So I cobbled this together.

This extension will add an overlay for the combined unread message count across all
mail accounts.

There are no configuration options.




[1] https://bugzilla.mozilla.org/show_bug.cgi?id=515907
[2] https://bugzilla.mozilla.org/show_bug.cgi?id=494137