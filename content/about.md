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
middle-school and late elementary special education, where studentds can form
letters reliably, but might struggle with how *sounds and spellings* are written
in different diosyncratic contexts or hearing differences in closely related sounds.  

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
and examine the networking tab. Although a Large Language Model (LLM) was used
in creating the page, no LLMs are used within the code that runs.  
This means the results are **fast**, **100% deterministic** and **local**. 

- Student names and spellings are saved in your own browser's local storage.
 When you come back to the website it will reload the data from there, but this
 is not persistent storage.
- **Save** writes a `.json` copy to your computer. That file is the preferred
  way to make a persistent store — clearing your browsing data will erase what
  is in the browser. In Chrome and Edge you pick that file once and Save writes
  back to the same one afterwards; in other browsers it downloads a copy each
  time, as it always has.
- **Open file** loads such a copy back, which is also how you can move your data to
  another computer.
- Printouts and CSV exports are generated in the browser and go straight to your
  own machine.

### If you save into a Drive or OneDrive folder

Everything above stays true: this page never sends anything anywhere, and you
can still check that in the network tab.

But it is worth being clear about what happens next. If you choose a folder that
**Google Drive or OneDrive keeps in sync**, that program — not this page — will
copy the file up to your school's cloud account, the same as it would for any
other file you put there. Student names would then be in your school's cloud
storage, under your school's policies.

That is a reasonable thing to want, and it is how most schools already handle
their documents. It is just your decision to make knowingly. If you would rather
it did not happen, pick a folder that is not synced.

If you need to share results anonymousely, **Hide student names** at the top of the
page replaces every name with "Student 1", "Student 2" and so on, everywhere
including printouts and CSV exports.

## Using it offline

The whole application is a single HTML file. You can save it to a USB stick or a
shared drive and open it by double-clicking, with no installation and no internet
connection. It should work in any modern browser. 

## Credits and licence

The pronunciation engine is [eSpeak NG](https://github.com/espeak-ng/espeak-ng),
compiled to run in the browser. Because eSpeak NG is licensed under the GPLv3,
this application is distributed under the same licence.
