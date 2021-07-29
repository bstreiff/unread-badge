# Deprecated.

This is a simple Thunderbird extension for displaying an unread mail message count
on the Windows taskbar.

This extension exists because older versions of Thunderbird only supported putting an
icon into the Windows notification area, and did not use the Windows 7-and-later
support for setting a badge on the application icon. However, the Thunderbird team
has [since integrated this extension into the core codebase](https://bugzilla.mozilla.org/show_bug.cgi?id=715799#c30),
so this extension is now no longer necessary as of Thunderbird 91.

As such, this repo is now legacy.

# unread-badge

This extension will add an overlay for the combined unread message count across all
mail accounts.

A configuration panel lets you choose between counting messages in all folders, or
to count the primary inbox only.

## Building
- Install [nodejs](https://nodejs.org/) (I've used 12.19.0 LTS).
- `npm run build`
- output will be in the `xpi` directory.

## Contributors

- [@bstreiff](https://github.com/bstreiff/) initially threw it together and occasionally reviews PRs.
- [@abcminiuser](https://github.com/abcminiuser) fixed filtering to ignore non-mail items.
- [@homo-programmatis](https://github.com/homo-programmatis) fixed several longstanding compatibility issues, first with Thunderbird 38+ then with 60+.
- [@jamesg-nz](https://github.com/jamesg-nz) added the first feature with a configuration UI (a way to count only the primary inbox) as well as ported to TB 68+.
