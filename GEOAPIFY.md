# Place suggestions

The optional Place autocomplete uses Geoapify Address Autocomplete directly from the browser. With `geoapifyApiKey: ""` in `app/config.js`, no Geoapify request is sent and the field remains a normal free-text input.

## Enable a real test

1. Create a Free account at https://myprojects.geoapify.com/ and create a project.
2. Obtain its API key and configure allowed HTTP referrers/origins for the local preview and your deployed site in the Geoapify dashboard.
3. Set `geoapifyApiKey` in `app/config.js` locally. This is a browser-visible location API key, not an OpenAI secret. Review its restrictions before committing or publishing it.
4. Open `/app/`, proceed to Memory, and try Vrnjacka Banja, Kotor, and hotel/place names relevant to your users. Local scripted tests use fixtures, not evidence of real geographic coverage.

Only the Place search string is sent to Geoapify, after at least three characters and 450ms idle time. Photos, memory and people are not sent. Requests time out after seven seconds. No GPS permission or map is used. Results carry a visible Powered by Geoapify link. Address Autocomplete may not find every hotel or business; this first integration does not yet combine a separate Places search or fetch descriptions/photos from the internet.

Selecting a suggestion preserves the exact input text and stores the selected formatted name, coordinates and place ID separately. `collect().placeLocation` exposes that optional metadata. Manual edits clear stale selection; Back/Forward keeps it; Start another clears it. This does not add visual facts about the place to the planner. If suggestions fail or return nothing, users can continue with their own text.

Test: with Playwright available and the local preview on port 8765, run `node tests/place-autocomplete.cjs`. No real Geoapify or OpenAI calls are made by this test.
