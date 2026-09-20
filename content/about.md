# About this tool

<!--
  This page is written in Markdown and compiled into the app when it is built.
  Edit this file, commit, and the deployed site updates itself.

  Headings, lists, **bold**, *italic*, `code`, [links](https://example.com),
  tables and block quotes all work. Everything below is a starting point —
  rewrite it however you like.
-->

Grapheme Spelling Test turns spelling tests into a sound-by-sound picture of
what a student can and cannot encode, including nonsense words. It was built for
middle-school and elementary special education, where the useful question
is not how many words were right but *which sounds and spellings* are secure.

## Who made it

This application was designed by Elizabeth Collman (a special education teacher)
and Forrest Collman (her brother, a neuroscientist) with the use of Claude Code
for implementation. 

## Feedback and bug reports

The source code for this application can be found [here](https://www.github.com/fcollman/grapheme_spelling_test). Bug reports and/or feedback are welcome on the issues site there. Note you will need to make a github account. 

## How your data is handled

**Nothing you type here ever leaves your computer.** There is no account, no
server and nobody listening to or tracking what you enter here. 
This page makes no network requests at all once it has loaded. 
If you want to verify this you can open the browser developer tools 
and examine the networking tab.

- Student names and spellings are saved in your own browser's local storage.
 When you come back to the website it will reload the data from there, but this
 is not persistent storage.
- **Save file** writes a `.json` copy to your computer. That file is the preferred
  way to make a persistent store — clearing your browsing data will erase what
  is in the browser.
- **Open file** loads such a copy back, which is also how you can move your data to
  another computer.
- Printouts and CSV exports are generated in the browser and go straight to your
  own machine.

If you are showing results to a family, **Hide student names** at the top of the
page replaces every name with "Student 1", "Student 2" and so on, everywhere
including printouts and exports.

## Using it offline

The whole application is a single HTML file. You can save it to a USB stick or a
shared drive and open it by double-clicking, with no installation and no internet
connection.

## Credits and licence

The pronunciation engine is [eSpeak NG](https://github.com/espeak-ng/espeak-ng),
compiled to run in the browser. Because eSpeak NG is licensed under the GPLv3,
this application is distributed under the same licence.
