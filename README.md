# unread-badge

This is a simple Thunderbird extension for displaying an unread mail message count
on the Windows taskbar.

Currently (up until at least Thunderbird 60.0, at the time of this writing) the only
unread notification option is to put an icon into the notification area (or,
[as it is often called](https://devblogs.microsoft.com/oldnewthing/20030910-00/?p=42583),
the system tray). Windows 7 and later allow you to badge the application's icon itself
with an overlay. The Mozilla core [supports setting the overlay](https://bugzilla.mozilla.org/show_bug.cgi?id=515907),
but the [bug for actually making Thunderbird do so](https://bugzilla.mozilla.org/show_bug.cgi?id=494137)
has existed since 2009 and is as yet unresolved. (Please vote for it!)

So I cobbled this together.

This extension will add an overlay for the combined unread message count across all
mail accounts.

A configuration panel lets you choose between counting messages in all folders, or
to count the primary inbox only.

## Contributors

- [@bstreiff](https://github.com/bstreiff/) initially threw it together and occasionally reviews PRs.
- [@abcminiuser](https://github.com/abcminiuser) fixed filtering to ignore non-mail items.
- [@homo-programmatis](https://github.com/homo-programmatis) fixed several longstanding compatibility issues, first with Thunderbird 38+ then with 60+.
- [@jamesg-nz](https://github.com/jamesg-nz) added the first feature with a configuration UI (a way to count only the primary inbox) as well as ported to TB 68+.
