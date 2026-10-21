# Idea for a Penrose Color Puzzle

I have a game idea and want to explore the feasability. First step is to create an exploration tool (= Penrose Coloring app).
If the exploration is successful then in a second step we will develop a Penrose Color Puzzle app.

## background: Game idea stems from "I love Hue too" app
There is the ios game https://apps.apple.com/de/app/i-love-hue-too/id1395332051^:
- it has certain predefined tilings of a 2D plane
- in the beginning you see the tiling with a sorted color sequence, e.g. PenroseColors\design\Puzzle1-sorted.PNG or PenroseColors\design\Puzzle2-sorted.PNG
- then sequence is shuffled and you get the unsorted color tiles,  e.g. PenroseColors\design\Puzzle1-unsorted.PNG or PenroseColors\design\Puzzle2-unsorted.PNG
- then user has to swap tiles until he again reaches the sorted state from the start.

see also an analysis of the game here https://share.google/aimode/9gE9q8xf5nuqqrt3m


## backgound: Penrose tiling

see https://en.wikipedia.org/wiki/Penrose_tiling for a introduction to the mathematics

see https://misc.0o0o.org/penrose/index.html for a simple tiling generator

Penrose tilings are often very simple colored with 2 or 3 colors, and do not strive for aesthetics such as the "i love Hue" game does

## background : HSL color model

The color scheme and transitions in the "i love Hue" game rely on color planes that are cut through the HSL color cone, cf. https://en.wikipedia.org/wiki/HSL_and_HSV

There masses of color pickers such as https://www.workwithcolor.com/hsl-color-picker-01.htm or color palette generators online

## My Penrose Color Puzzle game idea

First, I want to explore if we can generate Penrose P3 tilings (Thick and Thin rhombs) and color them in a way.
I would like to create a experimental Penrose Coloring app as in https://misc.0o0o.org/penrose/index.html that
- creates variations of penrose p3 tilings (such as in URL) 
- supports me to color them in a more fancy way using hsl color planes (thats the new functionality we have to work on)

Questions to be solved: 
- what are appealing patterns that can be used for a puzzle?
- what are appealing colorings the user likes to watch and to repair after shuffeling them
- How can we make a color puzzle solution unique, meaning that there is only one solution: how many tiles do I have to keep unchangable so that that the solution is unique

Second: when we have solved the questions above then we can think about creating a puzzle game.


