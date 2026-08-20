import { getReleases } from "./discogs-client.js";
import { convert } from "./discogs-parser.js";

const releases = await getReleases();
const json = releases.map(convert);
console.log(JSON.stringify(json, null, 4));
