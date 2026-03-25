# Project requirements

## MPP - Minimal Personal Project

- show a map with user-saved road segments. Every road segment has a star-rating of 1-5 and is shown in corresponding color
- segments follow the bike roads
- store segments in local storage
- has a mobile and desktop view
- marker shows user's current location
- functionality to center map on user

## MVP

- show a legend somewhere?
- store segments in firebase
- keep map centered on user, unless they have panned manually. In that case, re-enable keeping the map centered when the users clicks on "center on me"

## First after MVP

- selecting (tapping/clicking) segment shows segment length

## Backlog

- Add authentication. I prefer not to have an entire signup / login flow. Restrict it to myself as user?
- Discuss with Claude: what would be the easiest (can be hacky) way so only I have edit rights?
- if we implement more users: do we need hierarchy (e.g. me as admin, so I can remove other people's segments?)

- Edit:
  - change rating
  - delete segment
  - change start/end controlpoints (with just those we don't need to store controlpoints entered during creation; we could save original controlpoints at later stage; then when no original controlpoints are found, we use start and end as fallback
- Editen in mobile view?
  - change rating
  - delete segment
  - (x) marker draggen werkt niet
- remove map zoom controls
- add danger marker for veeroosters and such
- Add examples of rating:
  - slecht: niet of nauwelijks begaanbaar
  - matig: straatklinkers of erg grof asfalt; te doen voor korte stukjes
  - voldoende: groffer asfalt, acceptabel voor langere stukken.
  - goed: vrij glad asfalt.
  - geweldig: zeer glad asfalt

## To be determined

- Do we want segments to have a name

## Possible edge cases

- Segment overlaps with another segment (will probably already be the case on crossing roads)

## Way of working

Have Claude Code generate a prototype app. It does this in a single html file; all js and css are in the html.
