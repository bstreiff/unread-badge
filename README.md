This is a simple Thunderbird extension for displaying an unread mail message count
on the Windows taskbar.

Currently (in Thunderbird 24.2) the only unread notification option is to put an
icon into the system tray ("notification area"). Windows 7 and later allow you to
actually badge the application's icon itself with an overlay. The Mozilla core
[supports setting the overlay](https://bugzilla.mozilla.org/show_bug.cgi?id=515907),
but the [bug for actually making Thunderbird do so](https://bugzilla.mozilla.org/show_bug.cgi?id=494137)
has languished for about four years. Sigh.

So I cobbled this together.

This extension will add an overlay for the combined unread message count across all
mail accounts.

There are no configuration options.
